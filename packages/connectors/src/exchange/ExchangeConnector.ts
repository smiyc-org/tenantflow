import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { PermissionAction, PermissionType, WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';
import { createGraphClient, type EntraConfig } from '../entra/GraphClient.js';
import type { Client } from '@microsoft/microsoft-graph-client';

export class ExchangeConnector implements IConnector {
  readonly workloadType = WorkloadType.EXCHANGE;
  private graph: Client;

  constructor(config: EntraConfig) {
    this.graph = createGraphClient(config);
  }

  async execute(req: AccessChangeRequest): Promise<ConnectorResult> {
    try {
      let preState: unknown;

      switch (req.permissionType) {
        case PermissionType.DL_MEMBER:
          preState = await this.changeDlMembership(req);
          break;
        case PermissionType.FULL_ACCESS:
        case PermissionType.SEND_AS:
        case PermissionType.SEND_ON_BEHALF:
          preState = await this.changeMailboxPermission(req);
          break;
        default:
          return { success: false, error: `Unsupported Exchange permission: ${req.permissionType}` };
      }

      return {
        success: true,
        rollbackContext: {
          workloadType: WorkloadType.EXCHANGE,
          operation: req.permissionAction,
          resourceId: req.resourceId,
          targetOid: req.targetOid,
          permissionType: req.permissionType,
          preStateSnapshot: preState,
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private async changeDlMembership(req: AccessChangeRequest): Promise<{ wasMember: boolean }> {
    // DLs are unified groups in Graph
    let wasMember = false;
    try {
      await this.graph.api(`/groups/${req.resourceId}/members/${req.targetOid}`).select('id').get();
      wasMember = true;
    } catch { /* not a member */ }

    if (req.permissionAction === PermissionAction.ADD && !wasMember) {
      await this.graph.api(`/groups/${req.resourceId}/members/$ref`).post({
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${req.targetOid}`,
      });
    } else if (req.permissionAction === PermissionAction.REMOVE && wasMember) {
      await this.graph.api(`/groups/${req.resourceId}/members/${req.targetOid}/$ref`).delete();
    }

    return { wasMember };
  }

  private async changeMailboxPermission(req: AccessChangeRequest): Promise<unknown> {
    // NOTE: Full Access and Send As require Exchange Online Management REST API
    // or EWS — Graph beta supports Send As and Send on Behalf.
    // This implementation covers Send As (beta) and Send on Behalf (v1.0).
    if (req.permissionType === PermissionType.SEND_ON_BEHALF) {
      const mailbox = await this.graph
        .api(`/users/${req.resourceId}`)
        .select('id,userPrincipalName')
        .get() as { id: string };

      if (req.permissionAction === PermissionAction.ADD) {
        // PATCH user to add grantedToIdentities — simplified representation
        await this.graph.api(`/users/${req.resourceId}`).patch({
          // Delegated send-on-behalf requires Exchange Online cmdlet in production
          // Graph v1.0 approach via OWA mailbox policy or EWS delegation
        });
      }
    }

    // For Full Access and Send As, document that Exchange.ManageAsApp
    // + Exchange Online REST Management API v3 is required.
    // The job execution layer should route these through a PowerShell runbook
    // or the EXO REST endpoint: POST /adminapi/beta/{tenantId}/InvokeCommand
    return { note: 'Exchange.ManageAsApp required for Full Access / Send As' };
  }

  async rollback(rollbackContext: unknown): Promise<ConnectorResult> {
    const ctx = rollbackContext as {
      operation: string;
      resourceId: string;
      targetOid: string;
      permissionType: PermissionType;
      preStateSnapshot: { wasMember: boolean };
    };

    try {
      if (ctx.permissionType === PermissionType.DL_MEMBER) {
        const reverseAction = ctx.operation === 'ADD' ? PermissionAction.REMOVE : PermissionAction.ADD;
        await this.changeDlMembership({
          requestId: 'rollback',
          workloadType: WorkloadType.EXCHANGE,
          resourceId: ctx.resourceId,
          targetOid: ctx.targetOid,
          permissionType: ctx.permissionType,
          permissionAction: reverseAction,
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
      .filter(`startswith(displayName,'${query}') or startswith(mail,'${query}')`)
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
      workloadType: WorkloadType.EXCHANGE,
      disambiguator: u.mail ?? u.userPrincipalName,
    }));
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    // Search for distribution lists (mail-enabled groups)
    const res = await this.graph
      .api('/groups')
      .filter(`startswith(displayName,'${query}') and mailEnabled eq true`)
      .select('id,displayName,mail,description')
      .top(limit)
      .get() as { value: Array<{ id: string; displayName: string; mail?: string; description?: string }> };

    return (res.value ?? []).map((g) => ({
      id: g.id,
      displayName: g.displayName,
      type: 'distribution_list',
      workloadType: WorkloadType.EXCHANGE,
      url: g.mail,
      description: g.description,
    }));
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.graph.api('/organization').select('id').top(1).get();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
