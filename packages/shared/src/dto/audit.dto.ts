import type { AuditEventType, PermissionType, SourceApp, WorkloadType } from '../enums.js';

export interface AuditEventDto {
  id: string;
  eventId: string;
  requestId?: string;
  requestNumber?: string;
  eventType: AuditEventType;
  actorOid: string;
  actorUpn: string;
  actorIp?: string;
  actorRoles: string[];
  workloadType?: WorkloadType;
  resourceId?: string;
  permissionType?: PermissionType;
  targetOid?: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  sourceApp: SourceApp;
  createdAt: string;
}

export interface AuditFilterDto {
  eventType?: AuditEventType;
  workloadType?: WorkloadType;
  actorOid?: string;
  requestId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListDto {
  items: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
}
