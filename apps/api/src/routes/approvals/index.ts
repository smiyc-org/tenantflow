import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../../middleware/rbac.js';
import { PlatformRole, RequestStatus, AuditEventType, SourceApp } from '@tenantflow/shared';
import type { ApproveDto, RejectDto, ReassignDto } from '@tenantflow/shared';
import { WorkflowEngine } from '@tenantflow/workflow';
import { AuditLogger } from '@tenantflow/audit';
import { config } from '../../config.js';

const engine = new WorkflowEngine();

export async function approvalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);

  // Approver inbox
  fastify.get('/approvals', { preHandler: requireRole(PlatformRole.APPROVER) }, async (req, reply) => {
    const user = req.user!;
    const res = await fastify.db.query(
      `SELECT
        ast.token, ast.stage_index, ast.token_expires,
        r.id AS request_id, r.request_number, r.workload_type,
        r.resource_display, r.target_display, r.permission_type,
        r.permission_action, r.justification, r.access_end,
        r.total_stages, r.sla_deadline, r.created_at,
        u.upn AS requester_upn, u.display_name AS requester_display
       FROM approval_stages ast
       JOIN requests r ON r.id = ast.request_id
       JOIN users u ON u.id = r.requester_id
       WHERE ast.approver_id = $1
         AND ast.is_active = TRUE
         AND ast.action IS NULL
         AND ast.token_expires > now()
       ORDER BY ast.created_at ASC`,
      [user.id],
    );
    reply.send({ items: res.rows, total: res.rowCount });
  });

  // Approve via token
  fastify.post<{ Params: { token: string }; Body: ApproveDto }>(
    '/approvals/:token/approve',
    async (req, reply) => {
      await handleDecision(fastify, req.params.token, 'APPROVE', req.body.comment, req.user!, reply);
    },
  );

  // Reject via token
  fastify.post<{ Params: { token: string }; Body: RejectDto }>(
    '/approvals/:token/reject',
    async (req, reply) => {
      await handleDecision(fastify, req.params.token, 'REJECT', req.body.comment, req.user!, reply);
    },
  );

  // Reassign
  fastify.post<{ Params: { token: string }; Body: ReassignDto }>(
    '/approvals/:token/reassign',
    async (req, reply) => {
      const { token } = req.params;
      const user = req.user!;

      const stageRes = await fastify.db.query(
        `SELECT ast.*, r.status, r.total_stages, r.current_stage
         FROM approval_stages ast JOIN requests r ON r.id = ast.request_id
         WHERE ast.token = $1 AND ast.is_active = TRUE AND ast.token_expires > now()`,
        [token],
      );
      const stage = stageRes.rows[0] as {
        id: string; request_id: string; stage_index: number;
        status: RequestStatus; total_stages: number;
      } | undefined;

      if (!stage) { reply.code(404).send({ error: 'Token not found or expired' }); return; }

      // Deactivate current stage
      await fastify.db.query(
        `UPDATE approval_stages SET is_active = FALSE, reassigned_from = $1 WHERE id = $2`,
        [user.id, stage.id],
      );

      // Find or create new approver
      const newApproverRes = await fastify.db.query(
        `SELECT id FROM users WHERE oid = $1`,
        [req.body.newApproverOid],
      );
      let newApproverId = (newApproverRes.rows[0] as { id: string } | undefined)?.id;

      if (!newApproverId) {
        const insertRes = await fastify.db.query(
          `INSERT INTO users (oid, upn, display_name, roles)
           VALUES ($1, $2, $3, '{approver}') RETURNING id`,
          [req.body.newApproverOid, req.body.newApproverUpn, req.body.newApproverUpn],
        );
        newApproverId = (insertRes.rows[0] as { id: string }).id;
      }

      const newToken = generateApprovalToken(stage.request_id, stage.stage_index);
      await fastify.db.query(
        `INSERT INTO approval_stages (request_id, stage_index, approver_id, token, token_expires)
         VALUES ($1, $2, $3, $4, now() + interval '72 hours')`,
        [stage.request_id, stage.stage_index, newApproverId, newToken],
      );

      reply.send({ success: true, newToken });
    },
  );
}

async function handleDecision(
  fastify: FastifyInstance,
  token: string,
  action: 'APPROVE' | 'REJECT',
  comment: string | undefined,
  user: NonNullable<FastifyInstance['db']> extends never ? never : { id: string; oid: string; upn: string; roles: string[] },
  reply: Parameters<Parameters<FastifyInstance['post']>[1]>[1],
): Promise<void> {
  const stageRes = await fastify.db.query(
    `SELECT ast.*, r.status, r.total_stages, r.current_stage, r.id AS req_id,
            r.request_number, r.policy_id
     FROM approval_stages ast JOIN requests r ON r.id = ast.request_id
     WHERE ast.token = $1 AND ast.is_active = TRUE AND ast.token_expires > now()`,
    [token],
  );

  const stage = stageRes.rows[0] as {
    id: string; request_id: string; stage_index: number;
    status: RequestStatus; total_stages: number; current_stage: number;
    request_number: string;
  } | undefined;

  if (!stage) {
    reply.code(404).send({ error: 'Approval token not found or expired' });
    return;
  }

  if (stage.status !== `PENDING_APPROVAL_${stage.stage_index}`) {
    reply.code(409).send({ error: 'Request is no longer awaiting this approval' });
    return;
  }

  // Record decision
  await fastify.db.query(
    `UPDATE approval_stages SET action = $1, comment = $2, decision_at = now() WHERE id = $3`,
    [action, comment ?? null, stage.id],
  );

  const auditLogger = new AuditLogger({
    query: async (sql: string, params: unknown[]) => { await fastify.db.query(sql, params); },
  });

  if (action === 'REJECT') {
    await fastify.db.query(
      `UPDATE requests SET status = $1, updated_at = now() WHERE id = $2`,
      [RequestStatus.REJECTED, stage.request_id],
    );
    await auditLogger.log({
      requestId: stage.request_id,
      requestNumber: stage.request_number,
      eventType: AuditEventType.STAGE_REJECTED,
      actorOid: (user as { oid: string }).oid,
      actorUpn: (user as { upn: string }).upn,
      actorRoles: (user as { roles: string[] }).roles,
      sourceApp: SourceApp.WEB,
      metadata: { stageIndex: stage.stage_index, comment },
    });
    await fastify.queues.notification.add('request-rejected', { requestId: stage.request_id });
  } else {
    // Advance workflow
    const result = engine.advanceAfterApproval(
      {
        id: stage.request_id,
        status: stage.status,
        currentStage: stage.current_stage,
        totalStages: stage.total_stages,
        resourceId: '',
        workloadType: '',
        requesterId: '',
      },
      [],
    );

    await fastify.db.query(
      `UPDATE requests SET status = $1, current_stage = $2, sla_deadline = $3, updated_at = now() WHERE id = $4`,
      [result.newStatus, result.nextStageIndex ?? stage.stage_index, result.slaDeadline, stage.request_id],
    );

    await auditLogger.log({
      requestId: stage.request_id,
      requestNumber: stage.request_number,
      eventType: AuditEventType.STAGE_APPROVED,
      actorOid: (user as { oid: string }).oid,
      actorUpn: (user as { upn: string }).upn,
      actorRoles: (user as { roles: string[] }).roles,
      sourceApp: SourceApp.WEB,
      metadata: { stageIndex: stage.stage_index, newStatus: result.newStatus },
    });

    if (result.newStatus === RequestStatus.APPROVED) {
      await fastify.queues.executeAccess.add('execute', { requestId: stage.request_id });
    } else {
      await fastify.queues.notification.add('approval-request', {
        requestId: stage.request_id,
        stageIndex: result.nextStageIndex,
      });
    }
  }

  reply.send({ success: true });
}

function generateApprovalToken(requestId: string, stageIndex: number): string {
  return jwt.sign({ requestId, stageIndex }, config.security.jwtSecret, { expiresIn: '72h' });
}
