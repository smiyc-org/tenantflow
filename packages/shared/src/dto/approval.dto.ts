import type { ApprovalAction } from '../enums.js';

export interface ApproveDto {
  comment?: string;
}

export interface RejectDto {
  comment: string;
}

export interface ReassignDto {
  newApproverOid: string;
  newApproverUpn: string;
  comment?: string;
}

export interface ApprovalStageResponseDto {
  id: string;
  requestId: string;
  stageIndex: number;
  approverOid: string;
  approverUpn: string;
  approverDisplay: string;
  action?: ApprovalAction;
  comment?: string;
  decidedAt?: string;
  isActive: boolean;
  reminderSentAt?: string;
  createdAt: string;
}

export interface ApproverInboxDto {
  items: ApproverInboxItemDto[];
  total: number;
}

export interface ApproverInboxItemDto {
  token: string;
  requestId: string;
  requestNumber: string;
  requesterUpn: string;
  requesterDisplay: string;
  workloadType: string;
  resourceDisplay: string;
  targetDisplay: string;
  permissionType: string;
  permissionAction: string;
  justification: string;
  accessEnd?: string;
  stageIndex: number;
  totalStages: number;
  slaDeadline: string;
  createdAt: string;
}
