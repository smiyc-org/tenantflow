import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/rbac.js';
import type { CreateRequestDto, RequestFilterDto } from '@tenantflow/shared';
import { RequestStatus, WorkflowEvent } from '@tenantflow/shared';
import { WorkflowEngine } from '@tenantflow/workflow';
import { AuditLogger } from '@tenantflow/audit';
import { AuditEventType, SourceApp } from '@tenantflow/shared';

const engine = new WorkflowEngine();

export async function requestRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);

  // Create request
  fastify.post<{ Body: CreateRequestDto }>('/requests', async (req, reply) => {
    const user = req.user!;
    const body = req.body;

    // Load matching policy
    const policyRes = await fastify.db.query(
      `SELECT * FROM policies
       WHERE workload_type = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [body.workloadType],
    );
    const policy = policyRes.rows[0] as { id: string; stages: string; sla_hours: number; auto_approve: boolean } | undefined;

    const stages = policy ? (typeof policy.stages === 'string' ? JSON.parse(policy.stages) : policy.stages) : [];
    const totalStages = policy?.auto_approve ? 0 : stages.length;

    const result = await fastify.db.query(
      `INSERT INTO requests (
        requester_id, target_oid, target_display, target_upn,
        workload_type, resource_id, resource_display,
        permission_type, permission_action, justification,
        ticket_ref, access_start, access_end, policy_id,
        total_stages, status, tier_at_creation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        user.id, body.targetOid, body.targetDisplay, body.targetUpn ?? null,
        body.workloadType, body.resourceId, body.resourceDisplay,
        body.permissionType, body.permissionAction, body.justification,
        body.ticketRef ?? null,
        body.accessStart ? new Date(body.accessStart) : null,
        body.accessEnd ? new Date(body.accessEnd) : null,
        policy?.id ?? null,
        totalStages,
        totalStages === 0 ? RequestStatus.APPROVED : RequestStatus.PENDING_APPROVAL_1,
        fastify.config?.tier ?? 1,
      ],
    );

    const request = result.rows[0] as { id: string; request_number: string };

    const auditLogger = new AuditLogger({
      query: async (sql: string, params: unknown[]) => { await fastify.db.query(sql, params); },
    });

    await auditLogger.log({
      requestId: request.id,
      requestNumber: request.request_number,
      eventType: AuditEventType.REQUEST_CREATED,
      actorOid: user.oid,
      actorUpn: user.upn,
      actorRoles: user.roles,
      workloadType: body.workloadType,
      resourceId: body.resourceId,
      permissionType: body.permissionType,
      targetOid: body.targetOid,
      sourceApp: SourceApp.WEB,
      metadata: { totalStages, policyId: policy?.id },
    });

    // If approved immediately (auto-approve), queue execution
    if (totalStages === 0) {
      await fastify.queues.executeAccess.add('execute', { requestId: request.id });
    } else {
      // Notify first approver
      await fastify.queues.notification.add('approval-request', {
        requestId: request.id,
        stageIndex: 1,
      });
    }

    reply.code(201).send(request);
  });

  // List requests
  fastify.get<{ Querystring: RequestFilterDto }>('/requests', async (req, reply) => {
    const user = req.user!;
    const q = req.query;
    const isAdmin = user.roles.includes('policy_admin' as never) || user.roles.includes('super_admin' as never);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (!isAdmin) {
      conditions.push(`requester_id = $${p++}`);
      params.push(user.id);
    }
    if (q.status)       { conditions.push(`status = $${p++}`);       params.push(q.status); }
    if (q.workloadType) { conditions.push(`workload_type = $${p++}`); params.push(q.workloadType); }
    if (q.from)         { conditions.push(`created_at >= $${p++}`);   params.push(new Date(q.from)); }
    if (q.to)           { conditions.push(`created_at <= $${p++}`);   params.push(new Date(q.to)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? 20, 100);
    const offset = (page - 1) * pageSize;

    const [countRes, rowsRes] = await Promise.all([
      fastify.db.query(`SELECT COUNT(*) AS count FROM requests ${where}`, params),
      fastify.db.query(
        `SELECT r.*, u.upn AS requester_upn, u.display_name AS requester_display
         FROM requests r JOIN users u ON u.id = r.requester_id
         ${where} ORDER BY r.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
        [...params, pageSize, offset],
      ),
    ]);

    reply.send({
      items: rowsRes.rows,
      total: parseInt((countRes.rows[0] as { count: string }).count, 10),
      page,
      pageSize,
    });
  });

  // Get single request
  fastify.get<{ Params: { id: string } }>('/requests/:id', async (req, reply) => {
    const { id } = req.params;
    const res = await fastify.db.query(
      `SELECT r.*, u.upn AS requester_upn, u.display_name AS requester_display
       FROM requests r JOIN users u ON u.id = r.requester_id
       WHERE r.id = $1`,
      [id],
    );
    if (!res.rows[0]) { reply.code(404).send({ error: 'Not found' }); return; }
    reply.send(res.rows[0]);
  });

  // Cancel request
  fastify.delete<{ Params: { id: string } }>('/requests/:id', async (req, reply) => {
    const user = req.user!;
    const { id } = req.params;

    const res = await fastify.db.query(`SELECT * FROM requests WHERE id = $1`, [id]);
    const request = res.rows[0] as { status: RequestStatus; requester_id: string } | undefined;

    if (!request) { reply.code(404).send({ error: 'Not found' }); return; }
    if (request.requester_id !== user.id) { reply.code(403).send({ error: 'Forbidden' }); return; }

    if (!engine.canCancel(request.status)) {
      reply.code(409).send({ error: 'Request cannot be cancelled in its current state' });
      return;
    }

    await fastify.db.query(
      `UPDATE requests SET status = $1, updated_at = now() WHERE id = $2`,
      [RequestStatus.CANCELLED, id],
    );

    const auditLogger = new AuditLogger({
      query: async (sql: string, params: unknown[]) => { await fastify.db.query(sql, params); },
    });
    await auditLogger.log({
      requestId: id,
      eventType: AuditEventType.REQUEST_CANCELLED,
      actorOid: user.oid,
      actorUpn: user.upn,
      actorRoles: user.roles,
      sourceApp: SourceApp.WEB,
    });

    reply.send({ success: true });
  });
}

// Extend FastifyInstance for config access
declare module 'fastify' {
  interface FastifyInstance {
    config?: { tier: number };
  }
}
