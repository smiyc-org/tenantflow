import type { AudienceRole, ReportType, ScheduleType, WorkloadType } from '../enums.js';

export interface ReportSubscriptionDto {
  id: string;
  name: string;
  audienceRole: AudienceRole;
  recipientEmails: string[];
  scheduleType: ScheduleType;
  cronExpression?: string;
  reportType: ReportType;
  workloadFilter?: WorkloadType[];
  tagFilter?: string[];
  includeCsv: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  isActive: boolean;
  tierRequired: number;
  createdBy: string;
  createdAt: string;
}

export interface CreateReportSubscriptionDto {
  name: string;
  audienceRole: AudienceRole;
  recipientEmails: string[];
  scheduleType: ScheduleType;
  cronExpression?: string;
  reportType: ReportType;
  workloadFilter?: WorkloadType[];
  tagFilter?: string[];
  includeCsv?: boolean;
}

export interface ReportKpiDto {
  period: { from: string; to: string };
  totalRequests: number;
  byWorkload: Record<string, number>;
  byStatus: Record<string, number>;
  avgApprovalTimeHours: number;
  avgCompletionTimeHours: number;
  failureCount: number;
  topResources: Array<{ resourceDisplay: string; count: number }>;
  topRequesters: Array<{ requesterUpn: string; count: number }>;
}
