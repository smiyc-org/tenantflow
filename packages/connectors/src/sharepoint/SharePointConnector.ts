import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { PermissionAction, PermissionType, WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';
import { createGraphClient, type EntraConfig } from '../entra/GraphClient.js';
import type { Client } from '@microsoft/microsoft-graph-client';

const SP_ROLE_MAP: Partial<Record<PermissionType, string>> = {
  [PermissionType.READ]: 'read',
  [PermissionType.CONTRIBUTE]: 'write',
  [PermissionType.EDIT]: 'write',
  [PermissionType.FULL_CONTROL]: 'owner',
  [PermissionType.DESIGN]: 'owner',
};

export interface SpConfig extends EntraConfig {
  tenantName: string;
}

export class SharePointConnector implements IConnector {
  readonly workloadType = WorkloadType.SHAREPOINT;
  private graph: Client;

  constructor(private config: SpConfig) {
    this.graph = createGraphClient(config);
  }

  async execute(req: AccessChangeRequest): Promise<ConnectorResult> {
    try {
      const role = SP_ROLE_MAP[req.permissionType];
      if (!role) {
        return { success: false, error: `Unsupported SharePoint permission: ${req.permissionType}` };
      }

      if (req.permissionAction === PermissionAction.ADD) {
        const perm = await this.graph
          .api(`/sites/${req.resourceId}/permissions`)
          .post({
            roles: [role],
            grantedToIdentities: [
              {
                user: { id: req.targetOid },
              },
            ],
          }) as { id: string };

        return {
          success: true,
          rollbackContext: {
            workloadType: WorkloadType.SHAREPOINT,
            operation: 'ADD',
            resourceId: req.resourceId,
            targetOid: req.targetOid,
            permissionType: req.permissionType,
            preStateSnapshot: { permissionId: perm.id },
          },
        };
      } else {
        // Find the existing permission to delete
        const perms = await this.graph
          .api(`/sites/${req.resourceId}/permissions`)
          .get() as { value: Array<{ id: string; grantedToIdentities?: Array<{ user?: { id: string } }> }> };

        const match = perms.value.find((p) =>
          p.grantedToIdentities?.some((g) => g.user?.id === req.targetOid),
        );

        if (match) {
          await this.graph.api(`/sites/${req.resourceId}/permissions/${match.id}`).delete();
        }

        return {
          success: true,
          rollbackContext: {
            workloadType: WorkloadType.SHAREPOINT,
            operation: 'REMOVE',
            resourceId: req.resourceId,
            targetOid: req.targetOid,
            permissionType: req.permissionType,
            preStateSnapshot: { removedPermission: match ?? null },
          },
        };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async rollback(rollbackContext: unknown): Promise<ConnectorResult> {
    const ctx = rollbackContext as {
      operation: string;
      resourceId: string;
      targetOid: string;
      permissionType: PermissionType;
      preStateSnapshot: { permissionId?: string; removedPermission?: { id: string; roles?: string[] } | null };
    };

    try {
      if (ctx.operation === 'ADD' && ctx.preStateSnapshot.permissionId) {
        // Remove the permission we just added
        await this.graph
          .api(`/sites/${ctx.resourceId}/permissions/${ctx.preStateSnapshot.permissionId}`)
          .delete();
      } else if (ctx.operation === 'REMOVE' && ctx.preStateSnapshot.removedPermission) {
        // Re-grant what was removed
        const role = SP_ROLE_MAP[ctx.permissionType] ?? 'read';
        await this.graph.api(`/sites/${ctx.resourceId}/permissions`).post({
          roles: [role],
          grantedToIdentities: [{ user: { id: ctx.targetOid } }],
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async searchPrincipals(query: string, limit = 20): Promise<DirectoryObject[]> {
    const res = await this.graph
      .api('/users')
      .filter(`startswith(displayName,'${query}')`)
      .select('id,displayName,userPrincipalName,mail')
      .top(limit)
      .get() as { value: Array<{ id: string; displayName: string; userPrincipalName: string; mail?: string }> };

    return (res.value ?? []).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      type: 'user' as const,
      email: u.mail,
      upn: u.userPrincipalName,
      objectId: u.id,
      workloadType: WorkloadType.SHAREPOINT,
      disambiguator: u.userPrincipalName,
    }));
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    const res = await this.graph
      .api('/sites')
      .query({ search: query })
      .select('id,displayName,webUrl,description')
      .top(limit)
      .get() as { value: Array<{ id: string; displayName: string; webUrl?: string; description?: string }> };

    return (res.value ?? []).map((s) => ({
      id: s.id,
      displayName: s.displayName,
      type: 'sharepoint_site',
      url: s.webUrl,
      workloadType: WorkloadType.SHAREPOINT,
      description: s.description,
    }));
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.graph.api('/sites/root').select('id').get();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
