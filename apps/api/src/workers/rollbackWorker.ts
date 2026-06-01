import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES, RequestStatus, AuditEventType, SourceApp } from '@tenantflow/shared';
import type { ConnectorRegistry } from '@tenantflow/connectors';
import { AuditLogger } from '@tenantflow/audit';
import type pg from 'pg';

interface RollbackJob {
  requestId: string;
}

export function startRollbackWorker(db: pg.Pool, registry: ConnectorRegistry): Worker {
  return new Worker<RollbackJob>(
    QUEUE_NAMES.ROLLBACK_ACCESS,
    async (job: Job<RollbackJob>) => {
      const { requestId } = job.data;
      const logger = new AuditLogger({ query: async (sql, params) => { await db.query(sql, params); } });

      const res = await db.query(`SELECT * FROM requests WHERE id = $1`, [requestId]);
      const req = res.rows[0] as {
        id: string; request_number: string; workload_type: string;
        rollback_context: unknown;
      } | undefined;

      if (!req || !req.rollback_context) {
        throw new Error(`No rollback context for request ${requestId}`);
      }

      await logger.log({
        requestId,
        requestNumber: req.request_number,
        eventType: AuditEventType.ROLLBACK_STARTED,
        actorOid: 'system',
        actorUpn: 'system',
        sourceApp: SourceApp.API,
      });

      const connector = registry.get(req.workload_type as never);
      const result = await connector.rollback(req.rollback_context);

      if (result.success) {
        await db.query(
          `UPDATE requests SET status = $1, updated_at = now() WHERE id = $2`,
          [RequestStatus.ROLLED_BACK, requestId],
        );
        await logger.log({
          requestId,
          requestNumber: req.request_number,
          eventType: AuditEventType.ROLLBACK_COMPLETED,
          actorOid: 'system',
          actorUpn: 'system',
          sourceApp: SourceApp.API,
        });
      } else {
        await logger.log({
          requestId,
          requestNumber: req.request_number,
          eventType: AuditEventType.ROLLBACK_FAILED,
          actorOid: 'system',
          actorUpn: 'system',
          sourceApp: SourceApp.API,
          metadata: { error: result.error },
        });
        throw new Error(result.error ?? 'Rollback failed');
      }
    },
    {
      connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      concurrency: 3,
    },
  );
}
