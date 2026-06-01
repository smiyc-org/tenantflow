import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';

export interface IConnector {
  readonly workloadType: string;

  /** Execute an access change. Returns rollbackContext on success for later reversal. */
  execute(req: AccessChangeRequest): Promise<ConnectorResult>;

  /** Undo a previously successful change using the stored rollback context. */
  rollback(rollbackContext: unknown): Promise<ConnectorResult>;

  /** Search for principals (users/groups) matching the query. */
  searchPrincipals(query: string, limit?: number): Promise<DirectoryObject[]>;

  /** Search for resources (groups/sites/shares) matching the query. */
  searchResources(query: string, limit?: number): Promise<ResourceObject[]>;

  /** Verify the connector can reach its target system. */
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
