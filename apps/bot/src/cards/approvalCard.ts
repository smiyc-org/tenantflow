export interface ApprovalCardData {
  requestNumber: string;
  requestId: string;
  requesterDisplay: string;
  requesterUpn: string;
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
  approveToken: string;
  rejectToken: string;
}

export function buildApprovalCard(data: ApprovalCardData): object {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `Access Request — ${data.requestNumber}`,
        weight: 'Bolder',
        size: 'Medium',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: `Stage ${data.stageIndex} of ${data.totalStages} · SLA: ${new Date(data.slaDeadline).toLocaleString()}`,
        size: 'Small',
        isSubtle: true,
        spacing: 'None',
      },
      { type: 'Container', separator: true, spacing: 'Medium', items: [
        factRow('Requester', `${data.requesterDisplay} (${data.requesterUpn})`),
        factRow('Workload', data.workloadType),
        factRow('Resource', data.resourceDisplay),
        factRow('Target', data.targetDisplay),
        factRow('Action', `${data.permissionAction} ${data.permissionType}`),
        ...(data.accessEnd ? [factRow('Access Until', new Date(data.accessEnd).toLocaleDateString())] : []),
      ]},
      {
        type: 'TextBlock',
        text: `Justification: ${data.justification}`,
        wrap: true,
        spacing: 'Medium',
        size: 'Small',
      },
      {
        type: 'Input.Text',
        id: 'comment',
        placeholder: 'Optional comment...',
        isMultiline: false,
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ Approve',
        verb: 'approve',
        style: 'positive',
        data: { token: data.approveToken },
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'reject',
        style: 'destructive',
        data: { token: data.rejectToken },
      },
    ],
  };
}

function factRow(label: string, value: string): object {
  return {
    type: 'ColumnSet',
    columns: [
      { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: label + ':', weight: 'Bolder', size: 'Small' }] },
      { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: value, size: 'Small', wrap: true }] },
    ],
  };
}
