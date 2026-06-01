import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestsApi } from '../api/requests.js';
import { RequestStatus } from '@tenantflow/shared';

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.get(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => requestsApi.cancel(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['request', id] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!request) return <div className="p-8 text-center text-gray-400">Request not found.</div>;

  const canCancel = [
    RequestStatus.DRAFT,
    RequestStatus.PENDING_SUBMISSION,
    RequestStatus.PENDING_APPROVAL_1,
    RequestStatus.PENDING_APPROVAL_2,
    RequestStatus.PENDING_APPROVAL_3,
  ].includes(request.status as RequestStatus);

  const statusColors: Record<string, string> = {
    GRANTED: 'text-green-600 bg-green-50',
    REJECTED: 'text-red-600 bg-red-50',
    FAILED: 'text-red-600 bg-red-50',
    CANCELLED: 'text-gray-500 bg-gray-50',
    EXECUTING: 'text-blue-600 bg-blue-50',
    APPROVED: 'text-blue-600 bg-blue-50',
  };
  const statusCls = Object.entries(statusColors).find(([k]) => request.status.includes(k))?.[1] ?? 'text-yellow-600 bg-yellow-50';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/requests" className="text-sm text-gray-500 hover:text-ms-blue">← My Requests</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm text-gray-500">{request.requestNumber}</div>
            <h1 className="text-xl font-semibold text-gray-800 mt-1">
              {request.permissionAction} {request.permissionType} on {request.resourceDisplay}
            </h1>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusCls}`}>
            {request.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Workload" value={request.workloadType} />
          <Field label="Target Principal" value={request.targetPrincipalDisplay} />
          <Field label="Resource" value={request.resourceDisplay} />
          <Field label="Permission" value={`${request.permissionAction} ${request.permissionType}`} />
          <Field label="Submitted" value={new Date(request.createdAt).toLocaleString()} />
          {request.accessEnd && (
            <Field label="Access Expires" value={new Date(request.accessEnd).toLocaleString()} />
          )}
          {request.ticketRef && <Field label="Ticket Ref" value={request.ticketRef} />}
        </div>

        {request.justification && (
          <div className="px-6 pb-5 text-sm">
            <div className="text-gray-500 text-xs uppercase font-medium mb-1">Justification</div>
            <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">
              {request.justification}
            </div>
          </div>
        )}

        {request.stages && request.stages.length > 0 && (
          <div className="px-6 pb-5 border-t border-gray-100 pt-4">
            <div className="text-gray-500 text-xs uppercase font-medium mb-3">Approval Stages</div>
            <div className="space-y-3">
              {request.stages.map((stage: { stageIndex: number; assignedToDisplay: string; decision: string | null; comment: string | null; decidedAt: string | null }) => (
                <div key={stage.stageIndex} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    stage.decision === 'approve' ? 'bg-green-100 text-green-600' :
                    stage.decision === 'reject' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {stage.stageIndex}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">{stage.assignedToDisplay}</div>
                    {stage.decision && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {stage.decision === 'approve' ? '✅ Approved' : '❌ Rejected'}
                        {stage.decidedAt && ` — ${new Date(stage.decidedAt).toLocaleString()}`}
                      </div>
                    )}
                    {stage.comment && (
                      <div className="text-xs text-gray-600 mt-1 bg-gray-50 px-2 py-1 rounded">
                        "{stage.comment}"
                      </div>
                    )}
                    {!stage.decision && <div className="text-xs text-gray-400">Pending decision</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canCancel && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-medium uppercase mb-0.5">{label}</div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}
