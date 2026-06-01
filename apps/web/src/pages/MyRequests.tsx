import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { requestsApi } from '../api/requests.js';
import { RequestStatus } from '@tenantflow/shared';

const STATUS_COLORS: Partial<Record<RequestStatus, string>> = {
  [RequestStatus.GRANTED]: 'bg-green-100 text-green-700',
  [RequestStatus.REJECTED]: 'bg-red-100 text-red-700',
  [RequestStatus.CANCELLED]: 'bg-gray-100 text-gray-500',
  [RequestStatus.EXECUTING]: 'bg-blue-100 text-blue-700',
  [RequestStatus.APPROVED]: 'bg-blue-100 text-blue-700',
  [RequestStatus.FAILED]: 'bg-red-100 text-red-700',
  [RequestStatus.EXPIRED]: 'bg-gray-100 text-gray-500',
};

export function MyRequests() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['requests', 'mine', page, statusFilter],
    queryFn: () => requestsApi.list({ page, pageSize: 20, status: statusFilter || undefined }),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">My Requests</h1>
        <Link
          to="/requests/new"
          className="bg-ms-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
        >
          + New Request
        </Link>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {['', 'PENDING_APPROVAL_1', 'EXECUTING', 'GRANTED', 'REJECTED', 'FAILED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              statusFilter === s ? 'bg-ms-blue text-white border-ms-blue' : 'bg-white text-gray-600 border-gray-200 hover:border-ms-blue'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Request #</th>
                <th className="px-6 py-3 text-left">Workload</th>
                <th className="px-6 py-3 text-left">Resource</th>
                <th className="px-6 py-3 text-left">Permission</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((r) => {
                const statusCls = STATUS_COLORS[r.status as RequestStatus] ?? 'bg-yellow-100 text-yellow-700';
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <Link to={`/requests/${r.id}`} className="text-ms-blue hover:underline font-mono text-xs">
                        {r.requestNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{r.workloadType}</td>
                    <td className="px-6 py-3 text-gray-700 max-w-xs truncate">{r.resourceDisplay}</td>
                    <td className="px-6 py-3 text-gray-600">{r.permissionAction} {r.permissionType}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {!data?.items.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total ?? 0)} of {data?.total ?? 0}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
