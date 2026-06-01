import { apiClient } from './client.js';
import type { PlatformRole } from '@tenantflow/shared';

export const adminApi = {
  getStats(): Promise<{ requests: Record<string, number>; totalUsers: number; totalAuditEvents: number }> {
    return apiClient.get('/admin/stats').then((r) => r.data);
  },

  getLicense(): Promise<{ tier: number; tierName: string; expiresAt: string | null }> {
    return apiClient.get('/admin/license').then((r) => r.data);
  },

  getConnectorHealth(): Promise<{ connectors: Array<{ workload_type: string; display_name: string; is_enabled: boolean; last_tested_at: string | null; last_test_ok: boolean | null }> }> {
    return apiClient.get('/admin/health/connectors').then((r) => r.data);
  },

  listUsers(params?: { page?: number; pageSize?: number; search?: string }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return apiClient.get('/users', { params }).then((r) => r.data);
  },

  updateUserRole(userId: string, platformRole: PlatformRole): Promise<void> {
    return apiClient.patch(`/users/${userId}/role`, { platformRole }).then(() => undefined);
  },

  seedAdmin(): Promise<{ ok: boolean; message: string }> {
    return apiClient.post('/admin/seed-admin').then((r) => r.data);
  },
};
