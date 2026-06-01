import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../api/approvals.js';

export function Approvals() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalsApi.inbox(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ token, comment }: { token: string; comment?: string }) =>
      approvalsApi.approve(token, { comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ token, comment }: { token: string; comment: string }) =>
      approvalsApi.reject(token, { comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  const [comment, setComment] = useState<Record<string, string>>({});

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Pending Approvals</h1>

      {!data?.items.length && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No pending approvals. ✓
        </div>
      )}

      <div className="space-y-4">
        {data?.items.map((item) => (
          <div key={item.token} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="font-mono text-sm text-ms-blue font-medium">{item.requestNumber}</span>
                <span className="ml-3 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  Stage {item.stageIndex} of {item.totalStages}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                SLA: {new Date(item.slaDeadline).toLocaleString()}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
              <Item label="Requester" value={`${item.requesterDisplay} (${item.requesterUpn})`} />
              <Item label="Workload" value={item.workloadType} />
              <Item label="Resource" value={item.resourceDisplay} />
              <Item label="Target" value={item.targetDisplay} />
              <Item label="Action" value={`${item.permissionAction} ${item.permissionType}`} />
              {item.accessEnd && <Item label="Access Until" value={new Date(item.accessEnd).toLocaleDateString()} />}
              <div className="col-span-2">
                <dt className="text-gray-500 font-medium">Justification</dt>
                <dd className="text-gray-700 mt-0.5">{item.justification}</dd>
              </div>
            </dl>

            <textarea
              placeholder="Comment (required to reject)"
              value={comment[item.token] ?? ''}
              onChange={(e) => setComment((c) => ({ ...c, [item.token]: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-ms-blue"
            />

            <div className="flex gap-3">
              <button
                onClick={() => approveMutation.mutate({ token: item.token, comment: comment[item.token] })}
                disabled={approveMutation.isPending}
                className="bg-ms-green text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => {
                  const c = comment[item.token] ?? '';
                  if (!c.trim()) { alert('A comment is required to reject.'); return; }
                  rejectMutation.mutate({ token: item.token, comment: c });
                }}
                disabled={rejectMutation.isPending}
                className="bg-ms-red text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500 text-xs font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}
