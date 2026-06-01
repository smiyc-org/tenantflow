import { apiClient } from './client.js';
import type { SearchResultDto, SearchQueryDto } from '@tenantflow/shared';

export const searchApi = {
  search: (query: SearchQueryDto) =>
    apiClient.get<SearchResultDto>('/search', { params: query }).then((r) => r.data),

  permissions: (workloadType: string) =>
    apiClient.get('/search/permissions', { params: { workloadType } }).then((r) => r.data),
};
