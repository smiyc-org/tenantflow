import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { QUEUE_NAMES } from '@tenantflow/shared';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    queues: {
      executeAccess: Queue;
      rollbackAccess: Queue;
      notification: Queue;
      report: Queue;
      expiry: Queue;
    };
  }
}

async function redis(fastify: FastifyInstance): Promise<void> {
  const client = new Redis(config.redis.url, { maxRetriesPerRequest: null });

  const queueOpts = { connection: { url: config.redis.url } };

  fastify.decorate('redis', client);
  fastify.decorate('queues', {
    executeAccess: new Queue(QUEUE_NAMES.EXECUTE_ACCESS, queueOpts),
    rollbackAccess: new Queue(QUEUE_NAMES.ROLLBACK_ACCESS, queueOpts),
    notification: new Queue(QUEUE_NAMES.NOTIFICATION, queueOpts),
    report: new Queue(QUEUE_NAMES.REPORT, queueOpts),
    expiry: new Queue(QUEUE_NAMES.EXPIRY, queueOpts),
  });

  fastify.addHook('onClose', async () => {
    await client.quit();
  });
}

export default fp(redis, { name: 'redis' });
