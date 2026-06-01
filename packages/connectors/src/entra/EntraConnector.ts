import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { PermissionAction, PermissionType, WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';
import { createGraphClient, type EntraConfig } from './GraphClient.js';
import { EntraGroupManager } from './EntraGroupManager.js';
import { EntraSearch } from './EntraSearch.js';

export class EntraConnector implements IConnector {
  readonly workloadType = WorkloadType.ENTRA;
  private manager: EntraGroupManager;
  private searcher: EntraSearch;

  constructor(config: EntraConfig) {
    const graph = createGraphClient(config);
    this.manager = new EntraGroupManager(graph);
    this.searcher = new EntraSearch(graph);
  }

  async execute(req: AccessChangeRequest): Promise<ConnectorResult> {
    try {
      const isOwner = req.permissionType === PermissionType.OWNER;
      let snapshot: { groupId: string; targetId: string; wasPresent: boolean };

      if (req.permissionAction === PermissionAction.ADD) {
        snapshot = isOwner
          ? await this.manager.addOwner(req.resourceId, req.targetOid)
          : await this.manager.addMember(req.resourceId, req.targetOid);
      } else {
        snapshot = isOwner
          ? await this.manager.removeOwner(req.resourceId, req.targetOid)
          : await this.manager.removeMember(req.resourceId, req.targetOid);
      }

      return {
        success: true,
        rollbackContext: {
          workloadType: WorkloadType.ENTRA,
          operation: req.permissionAction,
          resourceId: req.resourceId,
          targetOid: req.targetOid,
          permissionType: req.permissionType,
          preStateSnapshot: snapshot,
        },
      };
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
      preStateSnapshot: { wasPresent: boolean };
    };

    try {
      const isOwner = ctx.permissionType === PermissionType.OWNER;
      // Reverse the operation only if the pre-state differed
      if (ctx.operation === 'ADD' && !ctx.preStateSnapshot.wasPresent) {
        isOwner
          ? await this.manager.removeOwner(ctx.resourceId, ctx.targetOid)
          : await this.manager.removeMember(ctx.resourceId, ctx.targetOid);
      } else if (ctx.operation === 'REMOVE' && ctx.preStateSnapshot.wasPresent) {
        isOwner
          ? await this.manager.addOwner(ctx.resourceId, ctx.targetOid)
          : await this.manager.addMember(ctx.resourceId, ctx.targetOid);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async searchPrincipals(query: string, limit = 20): Promise<DirectoryObject[]> {
    return this.searcher.searchPrincipals(query, limit);
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    return this.searcher.searchResources(query, limit);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.searcher.searchPrincipals('test', 1);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
