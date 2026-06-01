import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.js';
import { ReportType, ScheduleType } from '@tenantflow/shared';

export function Reports() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState<ReportType>(ReportType.DAILY_SUMMARY);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(ScheduleType.DAILY);
  const [recipientEmails, setRecipientEmails] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['report-subscriptions'],
    queryFn: () => reportsApi.listSubscriptions(),
  });

  const createMutation = useMutation({
    mutationFn: () => reportsApi.createSubscription({
      name,
      reportType,
      scheduleType,
      recipientEmails: recipientEmails.split(',').map((e) => e.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-subscriptions'] });
      setShowForm(false);
      setName('');
      setRecipientEmails('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.deleteSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-subscriptions'] }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => reportsApi.runNow(id),
    onSettled: () => setRunningId(null),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Report Subscriptions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-ms-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
        >
          + New Subscription
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Create Subscription</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-gray-600 block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Weekly Access Summary"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.values(ReportType).map((v) => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Schedule</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.values(ScheduleType).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-600 block mb-1">Recipient Emails (comma-separated)</label>
              <input
                type="text"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="admin@corp.com, auditor@corp.com"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name || createMutation.isPending}
              className="bg-ms-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Schedule</th>
              <th className="px-6 py-3 text-left">Recipients</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.items.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-800">{sub.name}</td>
                <td className="px-6 py-3 text-gray-600">{sub.reportType?.replace(/_/g, ' ')}</td>
                <td className="px-6 py-3 text-gray-600">{sub.scheduleType}</td>
                <td className="px-6 py-3 text-gray-500 text-xs">
                  {Array.isArray(sub.recipientEmails) ? sub.recipientEmails.join(', ') : ''}
                </td>
                <td className="px-6 py-3 flex gap-2">
                  <button
                    onClick={() => { setRunningId(sub.id); runNowMutation.mutate(sub.id); }}
                    disabled={runningId === sub.id}
                    className="text-xs text-ms-blue hover:underline disabled:opacity-50"
                  >
                    {runningId === sub.id ? 'Running…' : 'Run Now'}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(sub.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!data?.items.length && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No report subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
