import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { PlatformRole } from '@tenantflow/shared';
import { config } from '../config.js';

interface TokenClaims {
  oid: string;
  upn?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
  tid: string;
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    if (
      request.routerPath?.startsWith('/health') ||
      request.url.startsWith('/health')
    ) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    try {
      const claims = jwt.verify(token, config.jwtSecret, {
        algorithms: ['RS256', 'HS256'],
      }) as TokenClaims;

      const appRoles: string[] = claims.roles ?? [];
      let platformRole = PlatformRole.REQUESTER;
      if (appRoles.includes('SuperAdmin') || appRoles.includes('GlobalAdmin')) {
        platformRole = PlatformRole.SUPER_ADMIN;
      } else if (appRoles.includes('PolicyAdmin') || appRoles.includes('Admin')) {
        platformRole = PlatformRole.POLICY_ADMIN;
      } else if (appRoles.includes('Approver')) {
        platformRole = PlatformRole.APPROVER;
      } else if (appRoles.includes('Auditor')) {
        platformRole = PlatformRole.AUDITOR;
      } else if (appRoles.includes('Executor')) {
        platformRole = PlatformRole.EXECUTOR;
      }

      request.user = {
        id: claims.oid,
        oid: claims.oid,
        upn: claims.upn ?? claims.preferred_username ?? claims.oid,
        displayName: claims.name ?? claims.oid,
        roles: [platformRole],
      };

      fastify.db.query(
        `INSERT INTO users (entra_oid, upn, display_name, platform_role, last_seen_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (entra_oid) DO UPDATE
           SET upn = EXCLUDED.upn,
               display_name = EXCLUDED.display_name,
               last_seen_at = EXCLUDED.last_seen_at`,
        [claims.oid, request.user.upn, request.user.displayName, platformRole],
      ).catch(() => {/* non-fatal */});
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
