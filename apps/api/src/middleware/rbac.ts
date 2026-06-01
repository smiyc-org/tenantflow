import type { FastifyRequest, FastifyReply } from 'fastify';
import { PlatformRole } from '@tenantflow/shared';

export interface AuthUser {
  id: string;
  oid: string;
  upn: string;
  displayName: string;
  roles: PlatformRole[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function requireRole(...roles: PlatformRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const hasRole =
      user.roles.includes(PlatformRole.SUPER_ADMIN) ||
      roles.some((r) => user.roles.includes(r));

    if (!hasRole) {
      reply.code(403).send({ error: 'Forbidden', required: roles });
    }
  };
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}
