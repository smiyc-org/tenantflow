import { apiClient } from './client.js';
import type { ApproverInboxDto, ApproveDto, RejectDto, ReassignDto } from '@tenantflow/shared';

export const approvalsApi = {
  inbox: () => apiClient.get<ApproverInboxDto>('/approvals').then((r) => r.data),

  approve: (token: string, data: ApproveDto) =>
    apiClient.post<{ success: boolean }>(`/approvals/${token}/approve`, data).then((r) => r.data),

  reject: (token: string, data: RejectDto) =>
    apiClient.post<{ success: boolean }>(`/approvals/${token}/reject`, data).then((r) => r.data),

  reassign: (token: string, data: ReassignDto) =>
    apiClient.post(`/approvals/${token}/reassign`, data).then((r) => r.data),
};
