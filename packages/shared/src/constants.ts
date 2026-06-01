import type { TierLevel, WorkloadType } from './enums.js';

export const QUEUE_NAMES = {
  EXECUTE_ACCESS: 'execute-access',
  ROLLBACK_ACCESS: 'rollback-access',
  NOTIFICATION: 'notification',
  REPORT: 'report',
  EXPIRY: 'expiry',
} as const;

export const SLA_DEFAULTS = {
  FIRST_REMINDER_FRACTION: 0.5,
  DEFAULT_SLA_HOURS: 24,
  ESCALATION_GRACE_HOURS: 4,
} as const;

export const SEARCH_DEFAULTS = {
  MAX_RESULTS: 20,
  CACHE_TTL_SECONDS: 30,
  MIN_QUERY_LENGTH: 2,
} as const;

export const TOKEN_DEFAULTS = {
  APPROVAL_TOKEN_TTL_HOURS: 72,
} as const;

export const AUDIT_RETENTION_DAYS: Record<TierLevel, number> = {
  1: 90,
  2: 365,
  3: 2555, // 7 years
};

export const TIER_WORKLOADS: Record<TierLevel, WorkloadType[]> = {
  1: ['AD', 'ENTRA'] as WorkloadType[],
  2: ['AD', 'ENTRA', 'EXCHANGE', 'SHAREPOINT'] as WorkloadType[],
  3: ['AD', 'ENTRA', 'EXCHANGE', 'SHAREPOINT', 'FILESERVER'] as WorkloadType[],
};

export const REQUEST_NUMBER_PREFIX = 'AC';

export const MAX_APPROVAL_STAGES = 3;

export const MAX_NESTED_GROUP_DEPTH = 5;

export const ATTACHMENT_MAX_SIZE_MB = 10;
