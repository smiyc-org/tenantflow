import type { ReportKpiDto } from '@tenantflow/shared';

export function renderDailySummary(kpi: ReportKpiDto): string {
  const rows = Object.entries(kpi.byWorkload)
    .map(([w, c]) => `<tr><td>${w}</td><td>${c}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th { background: #0078d4; color: #fff; padding: 8px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
  .kpi { display: inline-block; background: #f3f9ff; border: 1px solid #0078d4;
         border-radius: 4px; padding: 12px 24px; margin: 8px; text-align: center; }
  .kpi-value { font-size: 28px; font-weight: bold; color: #0078d4; }
  .kpi-label { font-size: 12px; color: #666; }
</style></head>
<body>
  <h2>Access Concierge — Daily Summary</h2>
  <p>Period: <strong>${kpi.period.from.slice(0, 10)}</strong> to <strong>${kpi.period.to.slice(0, 10)}</strong></p>

  <div>
    <div class="kpi">
      <div class="kpi-value">${kpi.totalRequests}</div>
      <div class="kpi-label">Total Requests</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${kpi.avgApprovalTimeHours.toFixed(1)}h</div>
      <div class="kpi-label">Avg Approval Time</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${kpi.avgCompletionTimeHours.toFixed(1)}h</div>
      <div class="kpi-label">Avg Completion Time</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${kpi.failureCount}</div>
      <div class="kpi-label">Failures</div>
    </div>
  </div>

  <h3>Requests by Workload</h3>
  <table>
    <tr><th>Workload</th><th>Count</th></tr>
    ${rows}
  </table>

  <h3>Top Resources</h3>
  <table>
    <tr><th>Resource</th><th>Requests</th></tr>
    ${kpi.topResources.map((r) => `<tr><td>${r.resourceDisplay}</td><td>${r.count}</td></tr>`).join('')}
  </table>

  <h3>Top Requesters</h3>
  <table>
    <tr><th>User</th><th>Requests</th></tr>
    ${kpi.topRequesters.map((r) => `<tr><td>${r.requesterUpn}</td><td>${r.count}</td></tr>`).join('')}
  </table>

  <p style="font-size:11px;color:#999;margin-top:32px;">
    Sent by Access Concierge · Manage subscriptions in the portal
  </p>
</body>
</html>`;
}
