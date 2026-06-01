import type { DirectoryObject, ResourceObject, SearchResultDto, WorkloadType } from '@tenantflow/shared';
import { SEARCH_DEFAULTS } from '@tenantflow/shared';
import type { ConnectorRegistry } from '@tenantflow/connectors';

export interface SearchQuery {
  q: string;
  workload?: WorkloadType;
  type?: 'user' | 'group' | 'resource';
  limit?: number;
}

export class SearchFacade {
  constructor(private registry: ConnectorRegistry) {}

  async search(query: SearchQuery): Promise<SearchResultDto> {
    const start = Date.now();
    const limit = Math.min(query.limit ?? SEARCH_DEFAULTS.MAX_RESULTS, 50);

    if (query.q.length < SEARCH_DEFAULTS.MIN_QUERY_LENGTH) {
      return { principals: [], resources: [], query: query.q, durationMs: 0 };
    }

    const connectors = query.workload
      ? this.registry.has(query.workload) ? [this.registry.get(query.workload)] : []
      : this.registry.all();

    const principalResults: DirectoryObject[] = [];
    const resourceResults: ResourceObject[] = [];

    await Promise.allSettled(
      connectors.map(async (connector) => {
        if (query.type !== 'resource') {
          const p = await connector.searchPrincipals(query.q, limit).catch(() => []);
          principalResults.push(...p);
        }
        if (query.type !== 'user' && query.type !== 'group') {
          const r = await connector.searchResources(query.q, limit).catch(() => []);
          resourceResults.push(...r);
        }
      }),
    );

    return {
      principals: this.deduplicatePrincipals(principalResults).slice(0, limit),
      resources: resourceResults.slice(0, limit),
      query: query.q,
      durationMs: Date.now() - start,
    };
  }

  private deduplicatePrincipals(items: DirectoryObject[]): DirectoryObject[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.upn ?? item.sid ?? item.objectId ?? item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
