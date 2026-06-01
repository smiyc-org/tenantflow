import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../middleware/rbac.js';
import { PlatformRole, AuditEventType, SourceApp } from '@tenantflow/shared';
import type { CreatePolicyDto, UpdatePolicyDto } from '@tenantflow/shared';
import { AuditLogger } from '@tenantflow/audit';

const policyAdminGuard = requireRole(PlatformRole.POLICY_ADMIN, PlatformRole.SUPER_ADMIN);

export async function policyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/policies', { preHandler: policyAdminGuard }, async (_req, reply) => {
    const res = await fastify.db.query(`SELECT * FROM policies ORDER BY created_at DESC`);
    reply.send(res.rows);
  });

  fastify.post<{ Body: CreatePolicyDto }>(
    '/policies',
    { preHandler: policyAdminGuard },
    async (req, reply) => {
      const user = req.user!;
      const b = req.body;
      const res = await fastify.db.query(
        `INSERT INTO policies (name, workload_type, resource_pattern, sensitivity, stages,
          auto_approve, sla_hours, escalation_oid, auto_expire_hours,
          require_justification, require_ticket_ref, tier_required, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          b.name, b.workloadType, b.resourcePattern, b.sensitivity,
          JSON.stringify(b.stages), b.autoApprove ?? false,
          b.slaHours ?? 24, b.escalationOid ?? null, b.autoExpireHours ?? null,
          b.requireJustification ?? true, b.requireTicketRef ?? false,
          b.tierRequired ?? 1, user.id,
        ],
      );
      const auditLogger = new AuditLogger({ query: async (sql, params) => { await fastify.db.query(sql, params); } });
      await auditLogger.log({ eventType: AuditEventType.POLICY_CREATED, actorOid: user.oid, actorUpn: user.upn, actorRoles: user.roles, sourceApp: SourceApp.WEB, metadata: { policyId: (res.rows[0] as { id: string }).id } });
      reply.code(201).send(res.rows[0]);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/policies/:id',
    { preHandler: policyAdminGuard },
    async (req, reply) => {
      const res = await fastify.db.query(`SELECT * FROM policies WHERE id = $1`, [req.params.id]);
      if (!res.rows[0]) { reply.code(404).send({ error: 'Not found' }); return; }
      reply.send(res.rows[0]);
    },
  );

  fastify.put<{ Params: { id: string }; Body: UpdatePolicyDto }>(
    '/policies/:id',
    { preHandler: policyAdminGuard },
    async (req, reply) => {
      const user = req.user!;
      const b = req.body;
      const updates: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (b.name !== undefined)                { updates.push(`name = $${p++}`);                  params.push(b.name); }
      if (b.stages !== undefined)              { updates.push(`stages = $${p++}`);                params.push(JSON.stringify(b.stages)); }
      if (b.slaHours !== undefined)            { updates.push(`sla_hours = $${p++}`);             params.push(b.slaHours); }
      if (b.isActive !== undefined)            { updates.push(`is_active = $${p++}`);             params.push(b.isActive); }
      if (b.requireJustification !== undefined){ updates.push(`require_justification = $${p++}`); params.push(b.requireJustification); }

      if (!updates.length) { reply.code(400).send({ error: 'Nothing to update' }); return; }
      updates.push(`updated_at = now()`);

      const res = await fastify.db.query(
        `UPDATE policies SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
        [...params, req.params.id],
      );
      if (!res.rows[0]) { reply.code(404).send({ error: 'Not found' }); return; }

      const auditLogger = new AuditLogger({ query: async (sql, params) => { await fastify.db.query(sql, params); } });
      await auditLogger.log({ eventType: AuditEventType.POLICY_UPDATED, actorOid: user.oid, actorUpn: user.upn, actorRoles: user.roles, sourceApp: SourceApp.WEB, metadata: { policyId: req.params.id } });

      reply.send(res.rows[0]);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/policies/:id',
    { preHandler: policyAdminGuard },
    async (req, reply) => {
      const user = req.user!;
      await fastify.db.query(`DELETE FROM policies WHERE id = $1`, [req.params.id]);
      const auditLogger = new AuditLogger({ query: async (sql, params) => { await fastify.db.query(sql, params); } });
      await auditLogger.log({ eventType: AuditEventType.POLICY_DELETED, actorOid: user.oid, actorUpn: user.upn, actorRoles: user.roles, sourceApp: SourceApp.WEB, metadata: { policyId: req.params.id } });
      reply.send({ success: true });
    },
  );
}
