import { PlatformRole } from '@tenantflow/shared';
import type { ApprovalStageConfig } from '@tenantflow/shared';

export interface ResolvedApprover {
  oid: string;
  upn: string;
  displayName: string;
}

export interface UserContext {
  oid: string;
  upn: string;
  displayName: string;
  managerOid?: string;
  managerUpn?: string;
  managerDisplay?: string;
}

export interface ApproverLookup {
  getUserByOid(oid: string): Promise<ResolvedApprover | null>;
  getUsersByRole(role: PlatformRole): Promise<ResolvedApprover[]>;
  getResourceOwner(resourceId: string, workloadType: string): Promise<ResolvedApprover | null>;
}

export class StageEvaluator {
  async resolveApprover(
    stage: ApprovalStageConfig,
    requester: UserContext,
    resourceId: string,
    workloadType: string,
    lookup: ApproverLookup,
  ): Promise<ResolvedApprover | null> {
    switch (stage.approverType) {
      case 'manager': {
        if (!requester.managerOid) return null;
        return lookup.getUserByOid(requester.managerOid);
      }

      case 'resource_owner': {
        return lookup.getResourceOwner(resourceId, workloadType);
      }

      case 'role': {
        if (!stage.approverRole) return null;
        const members = await lookup.getUsersByRole(stage.approverRole);
        return members[0] ?? null;
      }

      case 'specific_user': {
        if (!stage.approverOid) return null;
        return lookup.getUserByOid(stage.approverOid);
      }
    }
  }
}
