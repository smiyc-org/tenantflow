import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

async function database(fastify: FastifyInstance): Promise<void> {
  const pool = new pg.Pool({
    connectionString: config.db.url,
    min: config.db.poolMin,
    max: config.db.poolMax,
  });

  await pool.query('SELECT 1');
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export default fp(database, { name: 'database' });
