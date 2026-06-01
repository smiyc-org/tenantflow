import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/rbac.js';
import { PlatformRole } from '@tenantflow/shared';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /users/me
  fastify.get('/users/me', async (request) => {
    const user = request.user!;
    const { rows } = await fastify.db.query(
      `SELECT id, entra_oid, upn, display_name, platform_role, last_seen_at, created_at
       FROM users WHERE entra_oid = $1`,
      [user.oid],
    );
    return rows[0] ?? { oid: user.oid, upn: user.upn, displayName: user.displayName, roles: user.roles };
  });

  // GET /users/me/notifications
  fastify.get('/users/me/notifications', async (request) => {
    const user = request.user!;
    const { rows } = await fastify.db.query(
      `SELECT COUNT(*) AS pending_approvals
       FROM approval_stages aps
       JOIN requests r ON r.id = aps.request_id
       WHERE aps.assigned_to_oid = $1
         AND aps.decision IS NULL
         AND r.status NOT IN ('CANCELLED','REJECTED','GRANTED','FAILED','ROLLED_BACK')`,
      [user.oid],
    );
    return { pendingApprovals: parseInt(rows[0].pending_approvals, 10) };
  });

  // GET /users — SUPER_ADMIN / POLICY_ADMIN only
  fastify.get('/users', async (request, reply) => {
    const user = request.user!;
    const isAdmin = user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
    if (!isAdmin) return reply.code(403).send({ error: 'Admin only' });

    const query = request.query as Record<string, string>;
    const page = parseInt(query.page ?? '1', 10);
    const pageSize = Math.min(parseInt(query.pageSize ?? '50', 10), 200);
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const { rows } = await fastify.db.query(
      `SELECT id, entra_oid, upn, display_name, platform_role, last_seen_at, created_at,
              COUNT(*) OVER() AS total_count
       FROM users
       WHERE ($1::text IS NULL OR upn ILIKE $1 OR display_name ILIKE $1)
       ORDER BY display_name
       LIMIT $2 OFFSET $3`,
      [search, pageSize, offset],
    );
    const total = rows[0] ? parseInt(rows[0].total_count, 10) : 0;
    return { items: rows, total, page, pageSize };
  });

  // PATCH /users/:id/role — SUPER_ADMIN only
  fastify.patch('/users/:id/role', async (request, reply) => {
    const user = request.user!;
    if (!user.roles.includes(PlatformRole.SUPER_ADMIN)) {
      return reply.code(403).send({ error: 'Super admin only' });
    }
    const { id } = request.params as { id: string };
    const body = request.body as { platformRole: PlatformRole };
    if (!Object.values(PlatformRole).includes(body.platformRole)) {
      return reply.code(400).send({ error: 'Invalid platform role' });
    }
    const { rowCount } = await fastify.db.query(
      `UPDATE users SET platform_role = $1 WHERE id = $2`,
      [body.platformRole, id],
    );
    if (!rowCount) return reply.code(404).send({ error: 'User not found' });
    return { ok: true };
  });
}
