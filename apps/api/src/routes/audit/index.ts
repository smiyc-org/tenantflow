import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../middleware/rbac.js';
import { PlatformRole } from '@tenantflow/shared';
import type { AuditFilterDto } from '@tenantflow/shared';
import { AuditReader, AuditExporter } from '@tenantflow/audit';
import { PassThrough } from 'stream';

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  const auditorGuard = requireRole(PlatformRole.AUDITOR, PlatformRole.SUPER_ADMIN);

  fastify.get<{ Querystring: AuditFilterDto }>(
    '/audit/events',
    { preHandler: auditorGuard },
    async (req, reply) => {
      const reader = new AuditReader({ query: async (sql, params) => fastify.db.query(sql, params) });
      const result = await reader.list(req.query);
      reply.send(result);
    },
  );

  fastify.get<{ Params: { eventId: string } }>(
    '/audit/events/:eventId',
    { preHandler: auditorGuard },
    async (req, reply) => {
      const reader = new AuditReader({ query: async (sql, params) => fastify.db.query(sql, params) });
      const event = await reader.getById(req.params.eventId);
      if (!event) { reply.code(404).send({ error: 'Not found' }); return; }
      reply.send(event);
    },
  );

  fastify.get<{ Querystring: AuditFilterDto }>(
    '/audit/export.csv',
    { preHandler: auditorGuard },
    async (req, reply) => {
      const exporter = new AuditExporter({ query: async (sql, params) => fastify.db.query(sql, params) });
      const pass = new PassThrough();
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="audit-export.csv"');
      reply.send(pass);
      await exporter.streamCsv(req.query, pass);
    },
  );
}
