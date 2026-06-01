import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { WorkloadType, PermissionAction } from '@tenantflow/shared';
import type { CreateRequestDto, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { requestsApi } from '../api/requests.js';
import { ResourceSearch } from '../components/request/ResourceSearch.js';

const WORKLOADS = [
  { value: WorkloadType.AD, label: 'Active Directory' },
  { value: WorkloadType.ENTRA, label: 'Entra ID / Azure AD' },
  { value: WorkloadType.EXCHANGE, label: 'Exchange Online' },
  { value: WorkloadType.SHAREPOINT, label: 'SharePoint Online' },
  { value: WorkloadType.FILESERVER, label: 'File Server' },
];

const PERMISSIONS_BY_WORKLOAD: Partial<Record<WorkloadType, string[]>> = {
  [WorkloadType.AD]: ['MEMBER'],
  [WorkloadType.ENTRA]: ['MEMBER', 'OWNER'],
  [WorkloadType.EXCHANGE]: ['DL_MEMBER', 'FULL_ACCESS', 'SEND_AS', 'SEND_ON_BEHALF'],
  [WorkloadType.SHAREPOINT]: ['READ', 'CONTRIBUTE', 'EDIT', 'FULL_CONTROL'],
  [WorkloadType.FILESERVER]: ['SMB_READ', 'SMB_CHANGE', 'SMB_FULL', 'NTFS_READ', 'NTFS_MODIFY', 'NTFS_FULL'],
};

export function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<CreateRequestDto>>({
    permissionAction: PermissionAction.ADD,
  });
  const [selectedTarget, setSelectedTarget] = useState<DirectoryObject | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceObject | null>(null);

  const mutation = useMutation({
    mutationFn: requestsApi.create,
    onSuccess: (data) => navigate(`/requests/${data.id}`),
  });

  const workload = form.workloadType;
  const permissions = workload ? PERMISSIONS_BY_WORKLOAD[workload] ?? [] : [];

  const canProceed = (): boolean => {
    if (step === 1) return !!form.workloadType;
    if (step === 2) return !!form.targetOid && !!form.resourceId && !!form.permissionType;
    if (step === 3) return !!form.justification && form.justification.length > 10;
    return true;
  };

  const submit = () => {
    if (!form.workloadType || !form.targetOid || !form.resourceId || !form.permissionType || !form.justification) return;
    mutation.mutate(form as CreateRequestDto);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">New Access Request</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {['Workload', 'Target & Permission', 'Justification', 'Preview'].map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1 rounded-full ${i < step ? 'bg-ms-blue' : 'bg-gray-200'}`} />
            <div className={`text-xs mt-1 ${i + 1 === step ? 'text-ms-blue font-medium' : 'text-gray-400'}`}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-medium text-gray-700">Select Workload</h2>
            <div className="grid grid-cols-2 gap-3">
              {WORKLOADS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setForm((f) => ({ ...f, workloadType: w.value }))}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    form.workloadType === w.value
                      ? 'border-ms-blue bg-blue-50 text-ms-blue'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm">{w.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && workload && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target User or Group</label>
              <ResourceSearch
                workload={workload}
                type="user"
                placeholder="Search for user or group..."
                onSelect={(item) => {
                  setSelectedTarget(item as DirectoryObject);
                  setForm((f) => ({
                    ...f,
                    targetOid: item.id,
                    targetDisplay: item.displayName,
                    targetUpn: 'upn' in item ? item.upn : undefined,
                  }));
                }}
              />
              {selectedTarget && (
                <p className="text-xs text-gray-500 mt-1">{selectedTarget.disambiguator}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
              <ResourceSearch
                workload={workload}
                type="resource"
                placeholder="Search for group, site, share..."
                onSelect={(item) => {
                  setSelectedResource(item as ResourceObject);
                  setForm((f) => ({
                    ...f,
                    resourceId: item.id,
                    resourceDisplay: item.displayName,
                  }));
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
              <select
                value={form.permissionType ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, permissionType: e.target.value as never }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue"
              >
                <option value="">Select permission...</option>
                {permissions.map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <div className="flex gap-3">
                {[PermissionAction.ADD, PermissionAction.REMOVE].map((a) => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={a}
                      checked={form.permissionAction === a}
                      onChange={() => setForm((f) => ({ ...f, permissionAction: a }))}
                    />
                    <span className="text-sm text-gray-700">{a}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access End Date (optional)</label>
              <input
                type="datetime-local"
                value={form.accessEnd ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, accessEnd: e.target.value || undefined }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.justification ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                rows={4}
                placeholder="Explain why this access is needed..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Reference (optional)</label>
              <input
                type="text"
                value={form.ticketRef ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ticketRef: e.target.value || undefined }))}
                placeholder="e.g. INC-12345"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-medium text-gray-700 mb-4">Review — What Will Change</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2 text-gray-700 border border-gray-200">
              <Row label="Workload" value={form.workloadType ?? ''} />
              <Row label="Action" value={`${form.permissionAction} ${form.permissionType}`} />
              <Row label="Target" value={form.targetDisplay ?? ''} />
              <Row label="Resource" value={form.resourceDisplay ?? ''} />
              <Row label="Justification" value={form.justification ?? ''} />
              {form.accessEnd && <Row label="Access Until" value={new Date(form.accessEnd).toLocaleString()} />}
              {form.ticketRef && <Row label="Ticket Ref" value={form.ticketRef} />}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              By submitting, you confirm this access is needed for legitimate business purposes
              and will be subject to approval.
            </p>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              ← Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="bg-ms-blue text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={mutation.isPending}
              className="bg-ms-green text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
