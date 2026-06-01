import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/rbac.js';
import { PlatformRole } from '@tenantflow/shared';

export async function ticketRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /tickets — list with optional request_id filter
  fastify.get('/tickets', async (request) => {
    const user = request.user!;
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page ?? '1', 10);
    const pageSize = Math.min(parseInt(query.pageSize ?? '25', 10), 100);
    const offset = (page - 1) * pageSize;
    const requestId = query.requestId ?? null;

    const isAdmin = user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
    const isAuditor = user.roles.includes(PlatformRole.AUDITOR);

    const { rows } = await fastify.db.query(
      `SELECT t.*, r.request_number, u.display_name AS requester_name,
              COUNT(*) OVER() AS total_count
       FROM tickets t
       JOIN requests r ON r.id = t.request_id
       JOIN users u ON u.entra_oid = r.requester_id
       WHERE ($1::uuid IS NULL OR t.request_id = $1::uuid)
         AND ($2 OR $3 OR r.requester_id = $4)
       ORDER BY t.created_at DESC
       LIMIT $5 OFFSET $6`,
      [requestId, isAdmin, isAuditor, user.oid, pageSize, offset],
    );
    const total = rows[0] ? parseInt(rows[0].total_count, 10) : 0;
    return { items: rows, total, page, pageSize };
  });

  // GET /tickets/export/csv — admin/auditor only
  fastify.get('/tickets/export/csv', async (request, reply) => {
    const user = request.user!;
    const isAdmin = user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
    const isAuditor = user.roles.includes(PlatformRole.AUDITOR);
    if (!isAdmin && !isAuditor) {
      return reply.code(403).send({ error: 'Admin or Auditor only' });
    }

    const { rows } = await fastify.db.query(
      `SELECT t.id, t.request_id, r.request_number, t.system, t.external_id,
              t.external_url, t.status, t.created_at, t.updated_at,
              u.upn AS requester_upn
       FROM tickets t
       JOIN requests r ON r.id = t.request_id
       JOIN users u ON u.entra_oid = r.requester_id
       ORDER BY t.created_at DESC`,
    );

    const header = 'id,request_id,request_number,system,external_id,external_url,status,requester_upn,created_at\n';
    const csv = rows.map((r) =>
      [r.id, r.request_id, r.request_number, r.system ?? '', r.external_id ?? '',
       r.external_url ?? '', r.status, r.requester_upn, r.created_at].join(','),
    ).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="tickets.csv"');
    return header + csv;
  });
}
