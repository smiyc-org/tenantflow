import type { Client } from '@microsoft/microsoft-graph-client';
import type { DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { WorkloadType } from '@tenantflow/shared';

export class EntraSearch {
  constructor(private graph: Client) {}

  async searchPrincipals(query: string, limit = 20): Promise<DirectoryObject[]> {
    const q = encodeURIComponent(query);
    const res = await this.graph
      .api('/users')
      .filter(`startswith(displayName,'${query}') or startswith(userPrincipalName,'${q}')`)
      .select('id,displayName,userPrincipalName,mail')
      .top(limit)
      .get() as { value: Array<{ id: string; displayName: string; userPrincipalName: string; mail?: string }> };

    return (res.value ?? []).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      type: 'user',
      email: u.mail,
      upn: u.userPrincipalName,
      objectId: u.id,
      workloadType: WorkloadType.ENTRA,
      disambiguator: `${u.userPrincipalName} | ${u.id}`,
    } satisfies DirectoryObject));
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    const res = await this.graph
      .api('/groups')
      .filter(`startswith(displayName,'${query}')`)
      .select('id,displayName,description,groupTypes,mail')
      .top(limit)
      .get() as { value: Array<{ id: string; displayName: string; description?: string; groupTypes?: string[]; mail?: string }> };

    return (res.value ?? []).map((g) => ({
      id: g.id,
      displayName: g.displayName,
      type: g.groupTypes?.includes('Unified') ? 'm365_group' : 'security_group',
      workloadType: WorkloadType.ENTRA,
      description: g.description,
      url: g.mail,
    } satisfies ResourceObject));
  }
}
