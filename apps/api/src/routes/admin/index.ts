import type { FastifyInstance } from 'fastify';
import type { AuthUser } from '../../middleware/rbac.js';
import { requireAuth } from '../../middleware/rbac.js';
import { PlatformRole } from '@tenantflow/shared';
import { config } from '../../config.js';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  function isAdmin(user: AuthUser) {
    return user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
  }

  // GET /admin/license
  fastify.get('/admin/license', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    return {
      tier: config.license.tier,
      tierName: `Tier ${config.license.tier}`,
      expiresAt: (config.license as { expiresAt?: string }).expiresAt ?? null,
    };
  });

  // GET /admin/health/connectors
  fastify.get('/admin/health/connectors', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { rows } = await fastify.db.query(
      `SELECT workload_type, display_name, is_enabled, last_tested_at, last_test_ok
       FROM connector_configs ORDER BY workload_type`,
    );
    return { connectors: rows };
  });

  // GET /admin/stats
  fastify.get('/admin/stats', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const [reqStats, userCount, auditCount] = await Promise.all([
      fastify.db.query(`SELECT status, COUNT(*) AS count FROM requests GROUP BY status`),
      fastify.db.query(`SELECT COUNT(*) AS count FROM users`),
      fastify.db.query(`SELECT COUNT(*) AS count FROM audit_events`),
    ]);
    return {
      requests: reqStats.rows.reduce(
        (acc: Record<string, number>, r: { status: string; count: string }) => ({ ...acc, [r.status]: parseInt(r.count, 10) }),
        {},
      ),
      totalUsers: parseInt(userCount.rows[0].count, 10),
      totalAuditEvents: parseInt(auditCount.rows[0].count, 10),
    };
  });

  // POST /admin/seed-admin — sets calling user as SUPER_ADMIN (only if no admins exist)
  fastify.post('/admin/seed-admin', async (request, reply) => {
    const user = request.user!;
    const { rows: adminRows } = await fastify.db.query(
      `SELECT COUNT(*) AS count FROM users WHERE platform_role IN ('super_admin','policy_admin')`,
    );
    if (parseInt(adminRows[0].count, 10) > 0) {
      return reply.code(409).send({ error: 'Admin already exists; use user role management' });
    }
    await fastify.db.query(
      `UPDATE users SET platform_role = $1 WHERE entra_oid = $2`,
      [PlatformRole.SUPER_ADMIN, user.oid],
    );
    return { ok: true, message: `${user.upn} promoted to Super Admin` };
  });
}
