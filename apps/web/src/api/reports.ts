import { apiClient } from './client.js';
import type { ReportSubscriptionDto, CreateReportSubscriptionDto } from '@tenantflow/shared';

export const reportsApi = {
  listSubscriptions(): Promise<{ items: ReportSubscriptionDto[] }> {
    return apiClient.get('/reports/subscriptions').then((r) => r.data);
  },

  createSubscription(dto: CreateReportSubscriptionDto): Promise<ReportSubscriptionDto> {
    return apiClient.post('/reports/subscriptions', dto).then((r) => r.data);
  },

  deleteSubscription(id: string): Promise<void> {
    return apiClient.delete(`/reports/subscriptions/${id}`).then(() => undefined);
  },

  runNow(id: string): Promise<{ ok: boolean; message: string }> {
    return apiClient.post(`/reports/run-now/${id}`).then((r) => r.data);
  },
};
