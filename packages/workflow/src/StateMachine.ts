import {
  RequestStatus,
  WorkflowEvent,
  type TransitionContext,
  type StateTransition,
} from '@tenantflow/shared';

export const TRANSITIONS: StateTransition[] = [
  {
    from: RequestStatus.DRAFT,
    event: WorkflowEvent.SUBMIT,
    to: RequestStatus.PENDING_SUBMISSION,
  },
  {
    from: RequestStatus.PENDING_SUBMISSION,
    event: WorkflowEvent.POLICY_EVALUATED,
    to: RequestStatus.PENDING_APPROVAL_1,
    guard: (ctx) => ctx.totalStages > 0,
  },
  {
    from: RequestStatus.PENDING_SUBMISSION,
    event: WorkflowEvent.POLICY_EVALUATED,
    to: RequestStatus.APPROVED,
    guard: (ctx) => ctx.totalStages === 0,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.STAGE_APPROVED,
    to: RequestStatus.PENDING_APPROVAL_2,
    guard: (ctx) => ctx.totalStages > 1 && ctx.currentStage === 1,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.STAGE_APPROVED,
    to: RequestStatus.APPROVED,
    guard: (ctx) => ctx.totalStages <= 1,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.STAGE_APPROVED,
    to: RequestStatus.PENDING_APPROVAL_3,
    guard: (ctx) => ctx.totalStages > 2 && ctx.currentStage === 2,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.STAGE_APPROVED,
    to: RequestStatus.APPROVED,
    guard: (ctx) => ctx.totalStages <= 2,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_3,
    event: WorkflowEvent.STAGE_APPROVED,
    to: RequestStatus.APPROVED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.STAGE_REJECTED,
    to: RequestStatus.REJECTED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.STAGE_REJECTED,
    to: RequestStatus.REJECTED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_3,
    event: WorkflowEvent.STAGE_REJECTED,
    to: RequestStatus.REJECTED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.ESCALATED,
    guard: (ctx) => ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.REJECTED,
    guard: (ctx) => !ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.ESCALATED,
    guard: (ctx) => ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.REJECTED,
    guard: (ctx) => !ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_3,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.ESCALATED,
    guard: (ctx) => ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_3,
    event: WorkflowEvent.SLA_BREACHED,
    to: RequestStatus.REJECTED,
    guard: (ctx) => !ctx.hasEscalationTarget,
  },
  {
    from: RequestStatus.ESCALATED,
    event: WorkflowEvent.ESCALATION_ACCEPTED,
    to: RequestStatus.PENDING_APPROVAL_1,
  },
  {
    from: RequestStatus.ESCALATED,
    event: WorkflowEvent.ESCALATION_REJECTED,
    to: RequestStatus.REJECTED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_1,
    event: WorkflowEvent.REQUESTER_CANCELLED,
    to: RequestStatus.CANCELLED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_2,
    event: WorkflowEvent.REQUESTER_CANCELLED,
    to: RequestStatus.CANCELLED,
  },
  {
    from: RequestStatus.PENDING_APPROVAL_3,
    event: WorkflowEvent.REQUESTER_CANCELLED,
    to: RequestStatus.CANCELLED,
  },
  {
    from: RequestStatus.APPROVED,
    event: WorkflowEvent.JOB_STARTED,
    to: RequestStatus.EXECUTING,
  },
  {
    from: RequestStatus.EXECUTING,
    event: WorkflowEvent.JOB_COMPLETED,
    to: RequestStatus.GRANTED,
    guard: (ctx) => ctx.connectorSuccess === true,
  },
  {
    from: RequestStatus.EXECUTING,
    event: WorkflowEvent.JOB_FAILED,
    to: RequestStatus.FAILED,
  },
  {
    from: RequestStatus.FAILED,
    event: WorkflowEvent.ROLLBACK_COMPLETED,
    to: RequestStatus.ROLLED_BACK,
  },
  {
    from: RequestStatus.FAILED,
    event: WorkflowEvent.ROLLBACK_FAILED,
    to: RequestStatus.FAILED,
  },
  {
    from: RequestStatus.GRANTED,
    event: WorkflowEvent.ACCESS_EXPIRED,
    to: RequestStatus.EXPIRED,
  },
  {
    from: RequestStatus.GRANTED,
    event: WorkflowEvent.MANUAL_REVOKE,
    to: RequestStatus.REVOKED,
  },
];

export const TERMINAL_STATES = new Set<RequestStatus>([
  RequestStatus.REJECTED,
  RequestStatus.CANCELLED,
  RequestStatus.EXPIRED,
  RequestStatus.REVOKED,
  RequestStatus.ROLLED_BACK,
]);

export const PENDING_APPROVAL_STATES = new Set<RequestStatus>([
  RequestStatus.PENDING_APPROVAL_1,
  RequestStatus.PENDING_APPROVAL_2,
  RequestStatus.PENDING_APPROVAL_3,
]);

export class StateMachine {
  transition(
    currentStatus: RequestStatus,
    event: WorkflowEvent,
    ctx: TransitionContext,
  ): RequestStatus | null {
    const candidates = TRANSITIONS.filter(
      (t) => t.from === currentStatus && t.event === event,
    );

    for (const t of candidates) {
      if (!t.guard || t.guard(ctx)) {
        return t.to;
      }
    }

    return null;
  }

  isTerminal(status: RequestStatus): boolean {
    return TERMINAL_STATES.has(status);
  }

  isPendingApproval(status: RequestStatus): boolean {
    return PENDING_APPROVAL_STATES.has(status);
  }

  stageIndexFromStatus(status: RequestStatus): number {
    switch (status) {
      case RequestStatus.PENDING_APPROVAL_1: return 1;
      case RequestStatus.PENDING_APPROVAL_2: return 2;
      case RequestStatus.PENDING_APPROVAL_3: return 3;
      default: return 0;
    }
  }

  statusFromStageIndex(index: number): RequestStatus {
    switch (index) {
      case 1: return RequestStatus.PENDING_APPROVAL_1;
      case 2: return RequestStatus.PENDING_APPROVAL_2;
      case 3: return RequestStatus.PENDING_APPROVAL_3;
      default: throw new Error(`Invalid stage index: ${index}`);
    }
  }
}
