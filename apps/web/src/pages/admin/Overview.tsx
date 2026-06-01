import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.js';

export function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
  });
  const { data: license } = useQuery({
    queryKey: ['admin', 'license'],
    queryFn: () => adminApi.getLicense(),
  });
  const { data: connectors } = useQuery({
    queryKey: ['admin', 'connectors'],
    queryFn: () => adminApi.getConnectorHealth(),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Admin Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} />
        <StatCard label="Total Audit Events" value={stats?.totalAuditEvents ?? '—'} />
        <StatCard
          label="License Tier"
          value={license ? `${license.tierName} (Tier ${license.tier})` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Request Status Breakdown</h2>
          </div>
          <div className="p-6 space-y-2">
            {stats?.requests ? Object.entries(stats.requests).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{status.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-gray-800">{count as number}</span>
              </div>
            )) : <div className="text-gray-400 text-sm">Loading…</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Connector Health</h2>
          </div>
          <div className="p-6 space-y-3">
            {connectors?.connectors.map((c) => (
              <div key={c.workload_type} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">{c.display_name}</div>
                  <div className="text-xs text-gray-400">{c.workload_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.last_test_ok === null ? (
                    <span className="text-xs text-gray-400">Not tested</span>
                  ) : c.last_test_ok ? (
                    <span className="text-xs text-green-600 font-medium">✓ OK</span>
                  ) : (
                    <span className="text-xs text-red-600 font-medium">✗ Failed</span>
                  )}
                  {c.last_tested_at && (
                    <span className="text-xs text-gray-400">
                      {new Date(c.last_tested_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!connectors?.connectors.length && (
              <div className="text-gray-400 text-sm">No connectors configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
