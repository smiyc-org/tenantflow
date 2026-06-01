import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { requestsApi } from '../api/requests.js';
import { approvalsApi } from '../api/approvals.js';
import { RequestStatus } from '@tenantflow/shared';

export function Dashboard() {
  const { data: myRequests } = useQuery({
    queryKey: ['requests', 'mine'],
    queryFn: () => requestsApi.list({ pageSize: 5 }),
  });

  const { data: approvals } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalsApi.inbox(),
  });

  const pendingApprovals = approvals?.items.length ?? 0;
  const activeRequests = myRequests?.items.filter(
    (r) => ![RequestStatus.GRANTED, RequestStatus.REJECTED, RequestStatus.CANCELLED, RequestStatus.EXPIRED].includes(r.status),
  ).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Active Requests" value={activeRequests} color="blue" />
        <KpiCard label="Pending Approvals" value={pendingApprovals} color="orange" />
        <KpiCard label="Total Requests" value={myRequests?.total ?? 0} color="gray" />
      </div>

      {pendingApprovals > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-orange-700 font-medium">
            You have {pendingApprovals} request{pendingApprovals !== 1 ? 's' : ''} awaiting your approval.
          </span>
          <Link to="/approvals" className="text-sm text-ms-blue font-medium hover:underline">
            Review now →
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">Recent Requests</h2>
          <Link to="/requests/new" className="text-sm bg-ms-blue text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
            + New Request
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Request #</th>
              <th className="px-6 py-3 text-left">Resource</th>
              <th className="px-6 py-3 text-left">Action</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {myRequests?.items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link to={`/requests/${r.id}`} className="text-ms-blue hover:underline font-mono">
                    {r.requestNumber}
                  </Link>
                </td>
                <td className="px-6 py-3 text-gray-700">{r.resourceDisplay}</td>
                <td className="px-6 py-3 text-gray-600">
                  {r.permissionAction} {r.permissionType}
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-6 py-3 text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!myRequests?.items.length && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No requests yet.{' '}
                  <Link to="/requests/new" className="text-ms-blue hover:underline">
                    Create your first request
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-ms-blue',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] ?? colors['gray']}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    GRANTED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    EXECUTING: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    FAILED: 'bg-red-100 text-red-700',
  };
  const cls = Object.entries(map).find(([k]) => status.includes(k))?.[1] ?? 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
