import type { FastifyInstance } from 'fastify';
import type { AuthUser } from '../../middleware/rbac.js';
import { requireAuth } from '../../middleware/rbac.js';
import { PlatformRole, WorkloadType } from '@tenantflow/shared';
import { config } from '../../config.js';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function encKey(): Buffer {
  const key = config.encryptionKey;
  // Pad or truncate to 32 bytes
  return Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
}

function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

export async function connectorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  function isAdmin(user: AuthUser) {
    return user.roles.includes(PlatformRole.SUPER_ADMIN) || user.roles.includes(PlatformRole.POLICY_ADMIN);
  }

  // GET /connectors
  fastify.get('/connectors', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { rows } = await fastify.db.query(
      `SELECT id, workload_type, display_name, is_enabled, last_tested_at, last_test_ok, created_at
       FROM connector_configs ORDER BY workload_type`,
    );
    return { items: rows };
  });

  // GET /connectors/:workloadType/status
  fastify.get('/connectors/:workloadType/status', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { workloadType } = request.params as { workloadType: string };
    const connector = fastify.connectorRegistry?.get(workloadType as WorkloadType);
    if (!connector) {
      return reply.code(404).send({ error: `Connector ${workloadType} not registered` });
    }
    const result = await connector.testConnection();
    await fastify.db.query(
      `UPDATE connector_configs SET last_tested_at = NOW(), last_test_ok = $1
       WHERE workload_type = $2`,
      [result.ok, workloadType],
    );
    return result;
  });

  // PUT /connectors/:workloadType
  fastify.put('/connectors/:workloadType', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { workloadType } = request.params as { workloadType: string };
    if (!Object.values(WorkloadType).includes(workloadType as WorkloadType)) {
      return reply.code(400).send({ error: 'Invalid workload type' });
    }
    const body = request.body as { displayName?: string; settings: Record<string, unknown>; enabled?: boolean };
    const encrypted = encrypt(JSON.stringify(body.settings), encKey());

    const { rows } = await fastify.db.query(
      `INSERT INTO connector_configs (workload_type, display_name, encrypted_settings, is_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workload_type) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             encrypted_settings = EXCLUDED.encrypted_settings,
             is_enabled = EXCLUDED.is_enabled,
             updated_at = NOW()
       RETURNING id, workload_type, display_name, is_enabled`,
      [workloadType, body.displayName ?? workloadType, encrypted, body.enabled ?? true],
    );
    return rows[0];
  });

  // GET /connectors/:workloadType/settings
  fastify.get('/connectors/:workloadType/settings', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { workloadType } = request.params as { workloadType: string };
    const { rows } = await fastify.db.query(
      `SELECT encrypted_settings FROM connector_configs WHERE workload_type = $1`,
      [workloadType],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Connector not configured' });
    try {
      const settings = JSON.parse(decrypt(rows[0].encrypted_settings, encKey()));
      for (const k of Object.keys(settings)) {
        if (/password|secret|key|token/i.test(k)) settings[k] = '***';
      }
      return settings;
    } catch {
      return reply.code(500).send({ error: 'Decryption failed' });
    }
  });

  // DELETE /connectors/:workloadType
  fastify.delete('/connectors/:workloadType', async (request, reply) => {
    if (!isAdmin(request.user!)) return reply.code(403).send({ error: 'Admin only' });
    const { workloadType } = request.params as { workloadType: string };
    const { rowCount } = await fastify.db.query(
      `DELETE FROM connector_configs WHERE workload_type = $1`,
      [workloadType],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Connector not configured' });
    return { ok: true };
  });
}
