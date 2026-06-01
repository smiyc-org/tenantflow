import { RequestStatus, WorkflowEvent } from '@tenantflow/shared';
import type { ApprovalStageConfig, TransitionContext, WorkflowPolicyConfig } from '@tenantflow/shared';
import { StateMachine, PENDING_APPROVAL_STATES } from './StateMachine.js';
import { SlaManager } from './SlaManager.js';

export interface WorkflowRequest {
  id: string;
  status: RequestStatus;
  currentStage: number;
  totalStages: number;
  resourceId: string;
  workloadType: string;
  requesterId: string;
  accessEnd?: Date;
}

export interface StageAdvanceResult {
  newStatus: RequestStatus;
  nextStageIndex: number | null;
  slaDeadline: Date | null;
}

export class WorkflowEngine {
  private sm = new StateMachine();
  private sla = new SlaManager();

  evaluatePolicy(policy: WorkflowPolicyConfig | null): {
    totalStages: number;
    stages: ApprovalStageConfig[];
    autoApprove: boolean;
  } {
    if (!policy || policy.autoApprove) {
      return { totalStages: 0, stages: [], autoApprove: true };
    }
    return {
      totalStages: policy.stages.length,
      stages: policy.stages,
      autoApprove: false,
    };
  }

  buildTransitionContext(req: WorkflowRequest, overrides?: Partial<TransitionContext>): TransitionContext {
    return {
      totalStages: req.totalStages,
      currentStage: req.currentStage,
      hasEscalationTarget: false,
      ...overrides,
    };
  }

  canCancel(status: RequestStatus): boolean {
    return PENDING_APPROVAL_STATES.has(status);
  }

  canRevoke(status: RequestStatus): boolean {
    return status === RequestStatus.GRANTED;
  }

  advanceAfterApproval(
    req: WorkflowRequest,
    stages: ApprovalStageConfig[],
  ): StageAdvanceResult {
    const ctx = this.buildTransitionContext(req);
    const newStatus = this.sm.transition(req.status, WorkflowEvent.STAGE_APPROVED, ctx);

    if (!newStatus) {
      throw new Error(`No transition from ${req.status} on STAGE_APPROVED`);
    }

    let nextStageIndex: number | null = null;
    let slaDeadline: Date | null = null;

    if (PENDING_APPROVAL_STATES.has(newStatus)) {
      nextStageIndex = this.sm.stageIndexFromStatus(newStatus);
      const stage = stages[nextStageIndex - 1];
      if (stage) {
        slaDeadline = this.sla.computeDeadline(stage.slaHours);
      }
    }

    return { newStatus, nextStageIndex, slaDeadline };
  }

  initialStageDeadline(stages: ApprovalStageConfig[]): Date | null {
    const first = stages[0];
    if (!first) return null;
    return this.sla.computeDeadline(first.slaHours);
  }
}
