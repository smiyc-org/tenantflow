import { apiClient } from './client.js';
import type { AuditListDto } from '@tenantflow/shared';

export const auditApi = {
  list(params: {
    requestId?: string;
    actorOid?: string;
    eventType?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AuditListDto> {
    return apiClient.get('/audit', { params }).then((r) => r.data);
  },

  exportCsv(params: { from?: string; to?: string }): Promise<Blob> {
    return apiClient
      .get('/audit/export/csv', { params, responseType: 'blob' })
      .then((r) => r.data);
  },
};
