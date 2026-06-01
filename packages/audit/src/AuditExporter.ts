import type { Writable } from 'stream';
import type { AuditFilterDto } from '@tenantflow/shared';
import type { QueryClient } from './AuditReader.js';

const CSV_HEADERS = [
  'event_id', 'request_number', 'event_type', 'actor_upn', 'actor_ip',
  'actor_roles', 'workload_type', 'resource_id', 'permission_type',
  'target_oid', 'source_app', 'created_at',
];

export class AuditExporter {
  constructor(private db: QueryClient) {}

  async streamCsv(filter: AuditFilterDto, output: Writable): Promise<void> {
    output.write(CSV_HEADERS.join(',') + '\n');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (filter.from) { conditions.push(`created_at >= $${p++}`); params.push(new Date(filter.from)); }
    if (filter.to)   { conditions.push(`created_at <= $${p++}`); params.push(new Date(filter.to)); }
    if (filter.workloadType) { conditions.push(`workload_type = $${p++}`); params.push(filter.workloadType); }
    if (filter.actorOid)     { conditions.push(`actor_oid = $${p++}`); params.push(filter.actorOid); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const result = await this.db.query<Record<string, unknown>>(
        `SELECT event_id, request_number, event_type, actor_upn, actor_ip,
                actor_roles, workload_type, resource_id, permission_type,
                target_oid, source_app, created_at
         FROM audit_events ${where}
         ORDER BY created_at ASC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, batchSize, offset],
      );

      if (result.rows.length === 0) break;

      for (const row of result.rows) {
        const line = CSV_HEADERS.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = Array.isArray(val) ? val.join(';') : String(val);
          return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',');
        output.write(line + '\n');
      }

      offset += batchSize;
      if (result.rows.length < batchSize) break;
    }

    output.end();
  }
}
