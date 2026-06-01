-- TenantFloe — Initial Schema
-- Migration 001

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oid           VARCHAR(36)  UNIQUE NOT NULL,
  upn           VARCHAR(320) UNIQUE NOT NULL,
  display_name  VARCHAR(256) NOT NULL,
  email         VARCHAR(320),
  roles         TEXT[]       NOT NULL DEFAULT ARRAY['requester'],
  department    VARCHAR(128),
  manager_oid   VARCHAR(36),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_oid ON users(oid);
CREATE INDEX idx_users_upn ON users(upn);

-- ── Policies ──────────────────────────────────────────────────────────────────

CREATE TABLE policies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(256) NOT NULL,
  workload_type        VARCHAR(64)  NOT NULL,
  resource_pattern     VARCHAR(512) NOT NULL DEFAULT '*',
  sensitivity          VARCHAR(32)  NOT NULL DEFAULT 'MEDIUM',
  stages               JSONB        NOT NULL DEFAULT '[]',
  auto_approve         BOOLEAN      NOT NULL DEFAULT FALSE,
  sla_hours            INTEGER      NOT NULL DEFAULT 24,
  escalation_oid       VARCHAR(36),
  auto_expire_hours    INTEGER,
  require_justification BOOLEAN     NOT NULL DEFAULT TRUE,
  require_ticket_ref   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  tier_required        SMALLINT     NOT NULL DEFAULT 1,
  created_by           UUID         NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_workload ON policies(workload_type);
CREATE INDEX idx_policies_active ON policies(is_active) WHERE is_active = TRUE;

-- ── Requests ──────────────────────────────────────────────────────────────────

CREATE SEQUENCE request_number_seq START 1;

CREATE TABLE requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number    VARCHAR(32)   UNIQUE NOT NULL DEFAULT (
    'TF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('request_number_seq')::text, 6, '0')
  ),
  status            VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',
  requester_id      UUID          NOT NULL REFERENCES users(id),
  target_oid        VARCHAR(36)   NOT NULL,
  target_display    VARCHAR(256)  NOT NULL,
  target_upn        VARCHAR(320),
  workload_type     VARCHAR(64)   NOT NULL,
  resource_id       VARCHAR(1024) NOT NULL,
  resource_display  VARCHAR(512)  NOT NULL,
  permission_type   VARCHAR(128)  NOT NULL,
  permission_action VARCHAR(16)   NOT NULL,
  justification     TEXT          NOT NULL,
  ticket_ref        VARCHAR(256),
  attachment_key    VARCHAR(512),
  access_start      TIMESTAMPTZ,
  access_end        TIMESTAMPTZ,
  policy_id         UUID          REFERENCES policies(id),
  current_stage     SMALLINT      NOT NULL DEFAULT 0,
  total_stages      SMALLINT      NOT NULL DEFAULT 0,
  sla_deadline      TIMESTAMPTZ,
  execution_job_id  VARCHAR(256),
  rollback_context  JSONB,
  executed_at       TIMESTAMPTZ,
  executed_by       UUID          REFERENCES users(id),
  error_detail      TEXT,
  tier_at_creation  SMALLINT      NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_requester ON requests(requester_id);
CREATE INDEX idx_requests_workload ON requests(workload_type);
CREATE INDEX idx_requests_created ON requests(created_at);
CREATE INDEX idx_requests_number ON requests(request_number);

-- ── Approval Stages ───────────────────────────────────────────────────────────

CREATE TABLE approval_stages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID         NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stage_index      SMALLINT     NOT NULL,
  approver_id      UUID         NOT NULL REFERENCES users(id),
  action           VARCHAR(16),
  decision_at      TIMESTAMPTZ,
  comment          TEXT,
  reassigned_from  UUID         REFERENCES users(id),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  token            VARCHAR(256) UNIQUE,
  token_expires    TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_stages_request ON approval_stages(request_id);
CREATE INDEX idx_approval_stages_approver ON approval_stages(approver_id) WHERE is_active = TRUE;
CREATE INDEX idx_approval_stages_token ON approval_stages(token) WHERE token IS NOT NULL;

-- ── Audit Events (append-only, partitioned by month) ─────────────────────────

CREATE TABLE audit_events (
  id            UUID         DEFAULT gen_random_uuid(),
  event_id      VARCHAR(64)  UNIQUE NOT NULL,
  request_id    UUID,
  request_number VARCHAR(32),
  event_type    VARCHAR(64)  NOT NULL,
  actor_oid     VARCHAR(36)  NOT NULL,
  actor_upn     VARCHAR(320) NOT NULL,
  actor_ip      INET,
  actor_roles   TEXT[]       NOT NULL DEFAULT '{}',
  workload_type VARCHAR(64),
  resource_id   VARCHAR(1024),
  permission_type VARCHAR(128),
  target_oid    VARCHAR(36),
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB,
  source_app    VARCHAR(32)  NOT NULL DEFAULT 'API',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create initial partitions (current month and next 3 months)
CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;

-- Prevent any modifications to audit records
CREATE OR REPLACE RULE audit_events_no_update AS
  ON UPDATE TO audit_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_events_no_delete AS
  ON DELETE TO audit_events DO INSTEAD NOTHING;

CREATE INDEX idx_audit_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_request_id ON audit_events(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_actor ON audit_events(actor_oid);
CREATE INDEX idx_audit_created ON audit_events(created_at);

-- ── Tickets ───────────────────────────────────────────────────────────────────

CREATE TABLE tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID         UNIQUE NOT NULL REFERENCES requests(id),
  external_system VARCHAR(32),
  external_id     VARCHAR(256),
  external_url    VARCHAR(1024),
  status          VARCHAR(32)  NOT NULL DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_request ON tickets(request_id);
CREATE INDEX idx_tickets_external ON tickets(external_system, external_id) WHERE external_id IS NOT NULL;

-- ── Report Subscriptions ──────────────────────────────────────────────────────

CREATE TABLE report_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(256) NOT NULL,
  audience_role     VARCHAR(32)  NOT NULL,
  recipient_emails  TEXT[]       NOT NULL DEFAULT '{}',
  schedule_type     VARCHAR(16)  NOT NULL DEFAULT 'DAILY',
  cron_expression   VARCHAR(64),
  report_type       VARCHAR(32)  NOT NULL DEFAULT 'SUMMARY',
  workload_filter   TEXT[],
  tag_filter        TEXT[],
  include_csv       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  tier_required     SMALLINT     NOT NULL DEFAULT 1,
  created_by        UUID         NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Connector Configs (encrypted) ─────────────────────────────────────────────

CREATE TABLE connector_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workload_type     VARCHAR(64)  UNIQUE NOT NULL,
  config_encrypted  BYTEA,
  config_iv         BYTEA,
  enabled           BOOLEAN      NOT NULL DEFAULT FALSE,
  last_tested_at    TIMESTAMPTZ,
  last_test_ok      BOOLEAN,
  last_error        TEXT,
  updated_by        UUID         REFERENCES users(id),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Access Expiry Jobs ────────────────────────────────────────────────────────

CREATE TABLE access_expiry_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID        NOT NULL REFERENCES requests(id),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoke_job_id  VARCHAR(256),
  status         VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expiry_status ON access_expiry_jobs(status, expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_expiry_request ON access_expiry_jobs(request_id);

-- ── Updated-at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at        BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER policies_updated_at     BEFORE UPDATE ON policies           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER requests_updated_at     BEFORE UPDATE ON requests           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tickets_updated_at      BEFORE UPDATE ON tickets            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER connector_configs_updated_at BEFORE UPDATE ON connector_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
