import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/rbac.js';
import type { SearchQueryDto } from '@tenantflow/shared';
import { WorkloadType, PermissionType } from '@tenantflow/shared';
import { SearchFacade } from '@tenantflow/search';
import { ConnectorRegistry } from '@tenantflow/connectors';

// Registry is populated at startup by the app factory
declare module 'fastify' {
  interface FastifyInstance {
    connectorRegistry: ConnectorRegistry;
  }
}

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);

  fastify.get<{ Querystring: SearchQueryDto }>('/search', async (req, reply) => {
    const facade = new SearchFacade(fastify.connectorRegistry);
    const result = await facade.search({
      q: req.query.q ?? '',
      workload: req.query.workload,
      type: req.query.type,
      limit: req.query.limit,
    });
    reply.send(result);
  });

  fastify.get<{ Querystring: { workloadType: WorkloadType } }>(
    '/search/permissions',
    async (req, reply) => {
      const { workloadType } = req.query;
      const permsByWorkload: Partial<Record<WorkloadType, PermissionType[]>> = {
        [WorkloadType.AD]: [PermissionType.MEMBER],
        [WorkloadType.ENTRA]: [PermissionType.MEMBER, PermissionType.OWNER],
        [WorkloadType.EXCHANGE]: [
          PermissionType.DL_MEMBER,
          PermissionType.FULL_ACCESS,
          PermissionType.SEND_AS,
          PermissionType.SEND_ON_BEHALF,
        ],
        [WorkloadType.SHAREPOINT]: [
          PermissionType.READ,
          PermissionType.CONTRIBUTE,
          PermissionType.EDIT,
          PermissionType.FULL_CONTROL,
        ],
        [WorkloadType.FILESERVER]: [
          PermissionType.SMB_READ,
          PermissionType.SMB_CHANGE,
          PermissionType.SMB_FULL,
          PermissionType.NTFS_READ,
          PermissionType.NTFS_MODIFY,
          PermissionType.NTFS_FULL,
        ],
      };
      reply.send({ workloadType, permissions: permsByWorkload[workloadType] ?? [] });
    },
  );
}
