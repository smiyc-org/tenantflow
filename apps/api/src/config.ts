import { TierLevel } from '@tenantflow/shared';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  port: optionalInt('PORT', 3000),
  nodeEnv: optional('NODE_ENV', 'development'),

  db: {
    url: required('DATABASE_URL'),
    poolMin: optionalInt('DATABASE_POOL_MIN', 2),
    poolMax: optionalInt('DATABASE_POOL_MAX', 20),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  entra: {
    tenantId: optional('ENTRA_TENANT_ID'),
    clientId: optional('ENTRA_CLIENT_ID'),
    certPath: optional('ENTRA_CERT_PATH'),
    certThumbprint: optional('ENTRA_CERT_THUMBPRINT'),
  },

  security: {
    encryptionKey: optional('ENCRYPTION_KEY'),
    jwtSecret: optional('JWT_SECRET', 'dev-secret-change-me'),
    sessionSecret: optional('SESSION_SECRET', 'dev-session-change-me'),
  },

  license: {
    tier: optionalInt('LICENSE_TIER', 1) as TierLevel,
    expiresAt: optional('LICENSE_EXPIRES_AT') || undefined,
  },

  encryptionKey: optional('ENCRYPTION_KEY', '0'.repeat(64)),
  jwtSecret: optional('JWT_SECRET', 'dev-secret-change-me'),

  ad: {
    ldapUrl: optional('AD_LDAP_URL'),
    bindDn: optional('AD_BIND_DN'),
    bindPassword: optional('AD_BIND_PASSWORD'),
    baseDn: optional('AD_BASE_DN'),
  },

  bot: {
    appId: optional('BOT_APP_ID'),
    appPassword: optional('BOT_APP_PASSWORD'),
  },

  email: {
    from: optional('SMTP_FROM', 'tenantfloe@corp.local'),
    smtpHost: optional('SMTP_HOST'),
    smtpPort: optionalInt('SMTP_PORT', 587),
    smtpUser: optional('SMTP_USER'),
    smtpPassword: optional('SMTP_PASSWORD'),
  },

  apiBaseUrl: optional('API_BASE_URL', 'http://localhost:3000'),

  servicenow: {
    baseUrl: optional('SERVICENOW_BASE_URL'),
    user: optional('SERVICENOW_USER'),
    password: optional('SERVICENOW_PASSWORD'),
  },

  jira: {
    baseUrl: optional('JIRA_BASE_URL'),
    userEmail: optional('JIRA_USER'),
    apiToken: optional('JIRA_API_TOKEN'),
    projectKey: optional('JIRA_PROJECT_KEY', 'AC'),
  },
} as const;
