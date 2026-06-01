import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  fastify.get('/health/ready', async (_req, reply) => {
    try {
      await fastify.db.query('SELECT 1');
      await fastify.redis.ping();
      reply.send({ status: 'ready', db: 'ok', redis: 'ok' });
    } catch (err) {
      reply.code(503).send({ status: 'unavailable', error: String(err) });
    }
  });
}
