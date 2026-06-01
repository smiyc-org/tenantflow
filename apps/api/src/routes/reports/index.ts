import type { FastifyInstance } from 'fastify';
import type { AuthUser } from '../../middleware/rbac.js';
import { requireAuth } from '../../middleware/rbac.js';
import { PlatformRole, ScheduleType, ReportType, AudienceRole } from '@tenantflow/shared';
import { ReportEngine } from '@tenantflow/reporting';
import { AuditReader } from '@tenantflow/audit';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  function isAdminOrAuditor(user: AuthUser) {
    return (
      user.roles.includes(PlatformRole.SUPER_ADMIN) ||
      user.roles.includes(PlatformRole.POLICY_ADMIN) ||
      user.roles.includes(PlatformRole.AUDITOR)
    );
  }

  // GET /reports/subscriptions
  fastify.get('/reports/subscriptions', async (request, reply) => {
    const user = request.user!;
    if (!isAdminOrAuditor(user)) return reply.code(403).send({ error: 'Admin or Auditor only' });
    const { rows } = await fastify.db.query(
      `SELECT * FROM report_subscriptions ORDER BY created_at DESC`,
    );
    return { items: rows };
  });

  // POST /reports/subscriptions
  fastify.post('/reports/subscriptions', async (request, reply) => {
    const user = request.user!;
    const isAdmin = user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
    if (!isAdmin) return reply.code(403).send({ error: 'Admin only' });

    const body = request.body as {
      name: string;
      reportType: ReportType;
      scheduleType: ScheduleType;
      cronExpr?: string;
      audienceRole?: AudienceRole;
      recipientEmails?: string[];
      filters?: Record<string, unknown>;
    };

    const { rows } = await fastify.db.query(
      `INSERT INTO report_subscriptions
         (name, report_type, schedule_type, cron_expr, audience_role, recipient_emails, filters, created_by_oid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.name, body.reportType, body.scheduleType,
        body.cronExpr ?? null,
        body.audienceRole ?? null,
        JSON.stringify(body.recipientEmails ?? []),
        JSON.stringify(body.filters ?? {}),
        user.oid,
      ],
    );
    return reply.code(201).send(rows[0]);
  });

  // DELETE /reports/subscriptions/:id
  fastify.delete('/reports/subscriptions/:id', async (request, reply) => {
    const user = request.user!;
    const isAdmin = user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
    if (!isAdmin) return reply.code(403).send({ error: 'Admin only' });

    const { id } = request.params as { id: string };
    const { rowCount } = await fastify.db.query(
      `DELETE FROM report_subscriptions WHERE id = $1`,
      [id],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Subscription not found' });
    return { ok: true };
  });

  // POST /reports/run-now/:id
  fastify.post('/reports/run-now/:id', async (request, reply) => {
    const user = request.user!;
    if (!isAdminOrAuditor(user)) return reply.code(403).send({ error: 'Admin or Auditor only' });

    const { id } = request.params as { id: string };
    const { rows } = await fastify.db.query(
      `SELECT * FROM report_subscriptions WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Subscription not found' });

    const engine = new ReportEngine(fastify.db, new AuditReader(fastify.db));
    try {
      await engine.run(rows[0]);
      return { ok: true, message: 'Report queued for delivery' };
    } catch (err) {
      fastify.log.error(err, 'Report run-now failed');
      return reply.code(500).send({ error: 'Report generation failed' });
    }
  });
}
