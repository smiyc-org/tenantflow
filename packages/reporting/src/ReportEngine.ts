import type { ReportKpiDto, WorkloadType } from '@tenantflow/shared';

export interface ReportDbClient {
  query<T>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export interface ReportFilter {
  from: Date;
  to: Date;
  workloadTypes?: WorkloadType[];
}

export class ReportEngine {
  constructor(private db: ReportDbClient) {}

  async computeKpi(filter: ReportFilter): Promise<ReportKpiDto> {
    const params: unknown[] = [filter.from, filter.to];
    let workloadCondition = '';
    if (filter.workloadTypes?.length) {
      workloadCondition = `AND workload_type = ANY($3::text[])`;
      params.push(filter.workloadTypes);
    }

    const base = `FROM requests WHERE created_at BETWEEN $1 AND $2 ${workloadCondition}`;

    const [total, byWorkload, byStatus, timings, failures, topResources, topRequesters] =
      await Promise.all([
        this.db.query<{ count: string }>(`SELECT COUNT(*) AS count ${base}`, params),
        this.db.query<{ workload_type: string; count: string }>(
          `SELECT workload_type, COUNT(*) AS count ${base} GROUP BY workload_type`, params),
        this.db.query<{ status: string; count: string }>(
          `SELECT status, COUNT(*) AS count ${base} GROUP BY status`, params),
        this.db.query<{ avg_approval: string; avg_completion: string }>(
          `SELECT
            AVG(EXTRACT(EPOCH FROM (sla_deadline - created_at)) / 3600) AS avg_approval,
            AVG(EXTRACT(EPOCH FROM (executed_at - created_at)) / 3600) AS avg_completion
           ${base} AND executed_at IS NOT NULL`, params),
        this.db.query<{ count: string }>(
          `SELECT COUNT(*) AS count ${base} AND status = 'FAILED'`, params),
        this.db.query<{ resource_display: string; count: string }>(
          `SELECT resource_display, COUNT(*) AS count ${base} GROUP BY resource_display ORDER BY count DESC LIMIT 10`, params),
        this.db.query<{ requester_upn: string; count: string }>(
          `SELECT u.upn AS requester_upn, COUNT(*) AS count ${base}
           JOIN users u ON u.id = requests.requester_id
           GROUP BY u.upn ORDER BY count DESC LIMIT 10`, params),
      ]);

    const workloadMap: Record<string, number> = {};
    for (const r of byWorkload.rows) workloadMap[r.workload_type] = parseInt(r.count, 10);

    const statusMap: Record<string, number> = {};
    for (const r of byStatus.rows) statusMap[r.status] = parseInt(r.count, 10);

    return {
      period: { from: filter.from.toISOString(), to: filter.to.toISOString() },
      totalRequests: parseInt(total.rows[0]?.count ?? '0', 10),
      byWorkload: workloadMap,
      byStatus: statusMap,
      avgApprovalTimeHours: parseFloat(timings.rows[0]?.avg_approval ?? '0'),
      avgCompletionTimeHours: parseFloat(timings.rows[0]?.avg_completion ?? '0'),
      failureCount: parseInt(failures.rows[0]?.count ?? '0', 10),
      topResources: topResources.rows.map((r) => ({
        resourceDisplay: r.resource_display,
        count: parseInt(r.count, 10),
      })),
      topRequesters: topRequesters.rows.map((r) => ({
        requesterUpn: r.requester_upn,
        count: parseInt(r.count, 10),
      })),
    };
  }
}
