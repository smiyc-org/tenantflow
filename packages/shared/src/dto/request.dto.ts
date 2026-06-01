import type { PermissionAction, PermissionType, RequestStatus, WorkloadType } from '../enums.js';

export interface CreateRequestDto {
  workloadType: WorkloadType;
  resourceId: string;
  resourceDisplay: string;
  targetOid: string;
  targetDisplay: string;
  targetUpn?: string;
  permissionType: PermissionType;
  permissionAction: PermissionAction;
  justification: string;
  ticketRef?: string;
  accessStart?: string;
  accessEnd?: string;
  attachmentKey?: string;
}

export interface RequestResponseDto {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  requesterId: string;
  requesterUpn: string;
  requesterDisplay: string;
  workloadType: WorkloadType;
  resourceId: string;
  resourceDisplay: string;
  targetOid: string;
  targetDisplay: string;
  targetUpn?: string;
  permissionType: PermissionType;
  permissionAction: PermissionAction;
  justification: string;
  ticketRef?: string;
  accessStart?: string;
  accessEnd?: string;
  currentStage: number;
  totalStages: number;
  slaDeadline?: string;
  executedAt?: string;
  errorDetail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestListDto {
  items: RequestResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RequestFilterDto {
  status?: RequestStatus;
  workloadType?: WorkloadType;
  requesterId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
