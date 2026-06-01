import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/audit.js';

export function AuditLog() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, eventType, from, to],
    queryFn: () => auditApi.list({
      page,
      pageSize: 50,
      eventType: eventType || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  function handleExportCsv() {
    auditApi.exportCsv({ from: from || undefined, to: to || undefined }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Audit Log</h1>
        <button
          onClick={handleExportCsv}
          className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-4 px-4 py-3 flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Event Type</label>
          <input
            type="text"
            placeholder="e.g. REQUEST_CREATED"
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded px-2 py-1 text-sm w-48"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Request #</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Event ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {data?.items.map((e) => (
                <tr key={e.eventId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-semibold text-gray-700">{e.eventType}</td>
                  <td className="px-4 py-2 text-ms-blue">{e.requestNumber ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-[12rem] truncate">{e.actorUpn ?? e.actorOid}</td>
                  <td className="px-4 py-2 text-gray-500">{e.sourceApp}</td>
                  <td className="px-4 py-2 text-gray-400 text-[10px] truncate max-w-[8rem]">{e.eventId.slice(0, 12)}…</td>
                </tr>
              ))}
              {!data?.items.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No audit events found.
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
            Page {page} of {totalPages} ({data?.total ?? 0} events)
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
