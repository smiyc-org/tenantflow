import { createHash } from 'crypto';
import type { AuditEventType, PermissionType, SourceApp, WorkloadType } from '@tenantflow/shared';

export interface AuditEventInput {
  requestId?: string;
  requestNumber?: string;
  eventType: AuditEventType;
  actorOid: string;
  actorUpn: string;
  actorIp?: string;
  actorRoles?: string[];
  workloadType?: WorkloadType;
  resourceId?: string;
  permissionType?: PermissionType;
  targetOid?: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  sourceApp?: SourceApp;
}

export interface DbClient {
  query(sql: string, params: unknown[]): Promise<void>;
}

export class AuditLogger {
  constructor(private db: DbClient) {}

  async log(event: AuditEventInput): Promise<void> {
    const now = new Date();
    const eventId = this.computeEventId(event, now);

    await this.db.query(
      `INSERT INTO audit_events (
        event_id, request_id, request_number, event_type,
        actor_oid, actor_upn, actor_ip, actor_roles,
        workload_type, resource_id, permission_type, target_oid,
        before_state, after_state, metadata, source_app, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        eventId,
        event.requestId ?? null,
        event.requestNumber ?? null,
        event.eventType,
        event.actorOid,
        event.actorUpn,
        event.actorIp ?? null,
        event.actorRoles ?? [],
        event.workloadType ?? null,
        event.resourceId ?? null,
        event.permissionType ?? null,
        event.targetOid ?? null,
        event.beforeState ? JSON.stringify(event.beforeState) : null,
        event.afterState ? JSON.stringify(event.afterState) : null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.sourceApp ?? 'API',
        now,
      ],
    );
  }

  private computeEventId(event: AuditEventInput, ts: Date): string {
    const raw = [
      event.requestId ?? '',
      event.eventType,
      event.actorOid,
      ts.toISOString(),
    ].join(':');
    return createHash('sha256').update(raw).digest('hex').slice(0, 64);
  }
}
