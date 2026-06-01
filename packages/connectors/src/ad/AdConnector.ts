import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { PermissionAction, WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';
import { AdClient, type AdConfig } from './AdClient.js';
import { AdGroupManager } from './AdGroupManager.js';
import { AdSearch } from './AdSearch.js';

export class AdConnector implements IConnector {
  readonly workloadType = WorkloadType.AD;
  private adClient: AdClient;
  private groupManager: AdGroupManager;
  private search: AdSearch;

  constructor(config: AdConfig) {
    this.adClient = new AdClient(config);
    this.groupManager = new AdGroupManager(this.adClient);
    this.search = new AdSearch(this.adClient);
  }

  async execute(req: AccessChangeRequest): Promise<ConnectorResult> {
    const client = await this.adClient.bind();
    try {
      if (req.permissionAction === PermissionAction.ADD) {
        const snapshot = await this.groupManager.addMember(client, req.resourceId, req.targetOid);
        return {
          success: true,
          rollbackContext: {
            workloadType: WorkloadType.AD,
            operation: 'ADD',
            resourceId: req.resourceId,
            targetOid: req.targetOid,
            permissionType: req.permissionType,
            preStateSnapshot: snapshot,
          },
        };
      } else {
        const snapshot = await this.groupManager.removeMember(client, req.resourceId, req.targetOid);
        return {
          success: true,
          rollbackContext: {
            workloadType: WorkloadType.AD,
            operation: 'REMOVE',
            resourceId: req.resourceId,
            targetOid: req.targetOid,
            permissionType: req.permissionType,
            preStateSnapshot: snapshot,
          },
        };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      this.adClient.unbind(client);
    }
  }

  async rollback(rollbackContext: unknown): Promise<ConnectorResult> {
    const ctx = rollbackContext as {
      resourceId: string;
      preStateSnapshot: { groupDn: string; membersBefore: string[] };
    };

    const client = await this.adClient.bind();
    try {
      await this.groupManager.restoreMembers(
        client,
        ctx.resourceId,
        ctx.preStateSnapshot.membersBefore,
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      this.adClient.unbind(client);
    }
  }

  async searchPrincipals(query: string, limit = 20): Promise<DirectoryObject[]> {
    const client = await this.adClient.bind();
    try {
      return await this.search.searchPrincipals(client, query, limit);
    } finally {
      this.adClient.unbind(client);
    }
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    const client = await this.adClient.bind();
    try {
      return await this.search.searchResources(client, query, limit);
    } finally {
      this.adClient.unbind(client);
    }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = await this.adClient.bind();
      this.adClient.unbind(client);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
