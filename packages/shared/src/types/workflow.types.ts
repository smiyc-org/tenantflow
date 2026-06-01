import type {
  ApprovalAction,
  PlatformRole,
  RequestStatus,
  ResourceSensitivity,
  WorkflowEvent,
  WorkloadType,
} from '../enums.js';

export interface ApprovalStageConfig {
  index: number;
  label: string;
  approverType: 'manager' | 'resource_owner' | 'role' | 'specific_user';
  approverRole?: PlatformRole;
  approverOid?: string;
  slaHours: number;
  escalationOid?: string;
  allowReassign: boolean;
}

export interface WorkflowPolicyConfig {
  stages: ApprovalStageConfig[];
  autoApprove: boolean;
  requireJustification: boolean;
  requireTicketRef: boolean;
  defaultAccessDurationHours?: number;
  allowPermanent: boolean;
}

export interface SlaConfig {
  slaHours: number;
  firstReminderAt: Date;
  escalationAt: Date;
  escalationOid?: string;
}

export interface StateTransition {
  from: RequestStatus;
  event: WorkflowEvent;
  to: RequestStatus;
  guard?: (ctx: TransitionContext) => boolean;
}

export interface TransitionContext {
  totalStages: number;
  currentStage: number;
  hasEscalationTarget: boolean;
  connectorSuccess?: boolean;
  rollbackSuccess?: boolean;
}

export interface ApprovalRecord {
  stageIndex: number;
  approverOid: string;
  approverUpn: string;
  action: ApprovalAction;
  comment?: string;
  decidedAt: Date;
}

export interface WorkflowSearchFilter {
  workloadType?: WorkloadType;
  sensitivity?: ResourceSensitivity;
  resourcePattern?: string;
}
