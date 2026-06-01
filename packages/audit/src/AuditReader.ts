import type { AuditEventDto, AuditFilterDto, AuditListDto } from '@tenantflow/shared';

export interface QueryClient {
  query<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export class AuditReader {
  constructor(private db: QueryClient) {}

  async list(filter: AuditFilterDto): Promise<AuditListDto> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (filter.eventType) {
      conditions.push(`event_type = $${p++}`);
      params.push(filter.eventType);
    }
    if (filter.workloadType) {
      conditions.push(`workload_type = $${p++}`);
      params.push(filter.workloadType);
    }
    if (filter.actorOid) {
      conditions.push(`actor_oid = $${p++}`);
      params.push(filter.actorOid);
    }
    if (filter.requestId) {
      conditions.push(`request_id = $${p++}`);
      params.push(filter.requestId);
    }
    if (filter.from) {
      conditions.push(`created_at >= $${p++}`);
      params.push(new Date(filter.from));
    }
    if (filter.to) {
      conditions.push(`created_at <= $${p++}`);
      params.push(new Date(filter.to));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filter.page ?? 1;
    const pageSize = Math.min(filter.pageSize ?? 50, 500);
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_events ${where}`,
      params,
    );

    const rows = await this.db.query<AuditEventDto>(
      `SELECT
        id, event_id AS "eventId", request_id AS "requestId",
        request_number AS "requestNumber", event_type AS "eventType",
        actor_oid AS "actorOid", actor_upn AS "actorUpn",
        actor_ip AS "actorIp", actor_roles AS "actorRoles",
        workload_type AS "workloadType", resource_id AS "resourceId",
        permission_type AS "permissionType", target_oid AS "targetOid",
        before_state AS "beforeState", after_state AS "afterState",
        metadata, source_app AS "sourceApp",
        created_at AS "createdAt"
       FROM audit_events ${where}
       ORDER BY created_at DESC
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, pageSize, offset],
    );

    return {
      items: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
      page,
      pageSize,
    };
  }

  async getById(eventId: string): Promise<AuditEventDto | null> {
    const result = await this.db.query<AuditEventDto>(
      `SELECT
        id, event_id AS "eventId", request_id AS "requestId",
        request_number AS "requestNumber", event_type AS "eventType",
        actor_oid AS "actorOid", actor_upn AS "actorUpn",
        actor_ip AS "actorIp", actor_roles AS "actorRoles",
        workload_type AS "workloadType", resource_id AS "resourceId",
        permission_type AS "permissionType", target_oid AS "targetOid",
        before_state AS "beforeState", after_state AS "afterState",
        metadata, source_app AS "sourceApp",
        created_at AS "createdAt"
       FROM audit_events WHERE event_id = $1`,
      [eventId],
    );
    return result.rows[0] ?? null;
  }
}
