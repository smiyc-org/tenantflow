import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.js';
import { PlatformRole } from '@tenantflow/shared';

const ROLES = Object.values(PlatformRole);

export function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.REQUESTER);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => adminApi.listUsers({ page, pageSize: 50, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingId(null);
    },
  });

  const users = (data?.items ?? []) as Array<{ id: string; upn: string; display_name: string; platform_role: PlatformRole; last_seen_at: string | null }>;
  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">User Management</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by UPN or display name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Display Name</th>
                <th className="px-6 py-3 text-left">UPN</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Last Seen</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs font-mono">{u.upn}</td>
                  <td className="px-6 py-3">
                    {editingId === u.id ? (
                      <div className="flex gap-2 items-center">
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as PlatformRole)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          onClick={() => roleMutation.mutate({ id: u.id, role: selectedRole })}
                          disabled={roleMutation.isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {u.platform_role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-3">
                    {editingId !== u.id && (
                      <button
                        onClick={() => { setEditingId(u.id); setSelectedRole(u.platform_role); }}
                        className="text-xs text-ms-blue hover:underline"
                      >
                        Change Role
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
