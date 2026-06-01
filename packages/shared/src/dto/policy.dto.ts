import type { PlatformRole, ResourceSensitivity, TierLevel, WorkloadType } from '../enums.js';
import type { ApprovalStageConfig } from '../types/workflow.types.js';

export interface WorkflowPolicyDto {
  id: string;
  name: string;
  workloadType: WorkloadType;
  resourcePattern: string;
  sensitivity: ResourceSensitivity;
  stages: ApprovalStageConfig[];
  autoApprove: boolean;
  slaHours: number;
  escalationOid?: string;
  autoExpireHours?: number;
  requireJustification: boolean;
  requireTicketRef: boolean;
  isActive: boolean;
  tierRequired: TierLevel;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyDto {
  name: string;
  workloadType: WorkloadType;
  resourcePattern: string;
  sensitivity: ResourceSensitivity;
  stages: ApprovalStageConfig[];
  autoApprove?: boolean;
  slaHours?: number;
  escalationOid?: string;
  autoExpireHours?: number;
  requireJustification?: boolean;
  requireTicketRef?: boolean;
  tierRequired?: TierLevel;
}

export interface UpdatePolicyDto extends Partial<CreatePolicyDto> {
  isActive?: boolean;
}

export interface PolicySimulateDto {
  workloadType: WorkloadType;
  resourceId: string;
  requesterId: string;
}

export interface PolicySimulateResponseDto {
  matchedPolicy?: WorkflowPolicyDto;
  stages: PolicyStagePreviewDto[];
  autoApprove: boolean;
  requireJustification: boolean;
  requireTicketRef: boolean;
}

export interface PolicyStagePreviewDto {
  stageIndex: number;
  label: string;
  approverType: string;
  approverRole?: PlatformRole;
  approverDisplay?: string;
  slaHours: number;
}
