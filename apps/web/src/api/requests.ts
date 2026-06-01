import { apiClient } from './client.js';
import type { CreateRequestDto, RequestResponseDto, RequestListDto, RequestFilterDto } from '@tenantflow/shared';

export const requestsApi = {
  create: (data: CreateRequestDto) =>
    apiClient.post<RequestResponseDto>('/requests', data).then((r) => r.data),

  list: (filter?: RequestFilterDto) =>
    apiClient.get<RequestListDto>('/requests', { params: filter }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<RequestResponseDto>(`/requests/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/requests/${id}`).then((r) => r.data),

  preview: (data: CreateRequestDto) =>
    apiClient.post('/requests/preview', data).then((r) => r.data),
};
