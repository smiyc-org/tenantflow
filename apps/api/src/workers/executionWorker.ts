import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES, RequestStatus, AuditEventType, SourceApp } from '@tenantflow/shared';
import type { ConnectorRegistry } from '@tenantflow/connectors';
import { AuditLogger } from '@tenantflow/audit';
import type pg from 'pg';

interface ExecuteJob {
  requestId: string;
}

export function startExecutionWorker(db: pg.Pool, registry: ConnectorRegistry): Worker {
  const auditDb = { query: async (sql: string, params: unknown[]) => { await db.query(sql, params); } };

  return new Worker<ExecuteJob>(
    QUEUE_NAMES.EXECUTE_ACCESS,
    async (job: Job<ExecuteJob>) => {
      const { requestId } = job.data;
      const logger = new AuditLogger(auditDb);

      // Load request
      const res = await db.query(`SELECT * FROM requests WHERE id = $1`, [requestId]);
      const req = res.rows[0] as {
        id: string; request_number: string; workload_type: string;
        resource_id: string; target_oid: string; permission_type: string;
        permission_action: string; access_end: Date | null;
        requester_id: string;
      } | undefined;

      if (!req) throw new Error(`Request ${requestId} not found`);

      // Update status to EXECUTING
      await db.query(
        `UPDATE requests SET status = $1, updated_at = now() WHERE id = $2`,
        [RequestStatus.EXECUTING, requestId],
      );

      await logger.log({
        requestId,
        requestNumber: req.request_number,
        eventType: AuditEventType.EXECUTION_STARTED,
        actorOid: 'system',
        actorUpn: 'system',
        workloadType: req.workload_type as never,
        resourceId: req.resource_id,
        permissionType: req.permission_type as never,
        targetOid: req.target_oid,
        sourceApp: SourceApp.API,
        metadata: { jobId: job.id },
      });

      // Execute via connector
      const connector = registry.get(req.workload_type as never);
      const result = await connector.execute({
        requestId,
        workloadType: req.workload_type as never,
        resourceId: req.resource_id,
        targetOid: req.target_oid,
        permissionType: req.permission_type as never,
        permissionAction: req.permission_action as never,
        accessEnd: req.access_end ?? undefined,
      });

      if (result.success) {
        await db.query(
          `UPDATE requests SET status = $1, executed_at = now(), rollback_context = $2, updated_at = now() WHERE id = $3`,
          [RequestStatus.GRANTED, JSON.stringify(result.rollbackContext), requestId],
        );

        await logger.log({
          requestId,
          requestNumber: req.request_number,
          eventType: AuditEventType.ACCESS_GRANTED,
          actorOid: 'system',
          actorUpn: 'system',
          workloadType: req.workload_type as never,
          resourceId: req.resource_id,
          permissionType: req.permission_type as never,
          targetOid: req.target_oid,
          afterState: result.rollbackContext,
          sourceApp: SourceApp.API,
        });

        // Schedule expiry if time-bound
        if (req.access_end) {
          const delayMs = Math.max(0, req.access_end.getTime() - Date.now());
          await db.query(
            `INSERT INTO access_expiry_jobs (request_id, expires_at, status)
             VALUES ($1, $2, 'PENDING')`,
            [requestId, req.access_end],
          );
          // Delayed job handled by expiry worker
        }
      } else {
        await db.query(
          `UPDATE requests SET status = $1, error_detail = $2, updated_at = now() WHERE id = $3`,
          [RequestStatus.FAILED, result.error, requestId],
        );

        await logger.log({
          requestId,
          requestNumber: req.request_number,
          eventType: AuditEventType.EXECUTION_FAILED,
          actorOid: 'system',
          actorUpn: 'system',
          sourceApp: SourceApp.API,
          metadata: { error: result.error },
        });

        throw new Error(result.error ?? 'Connector execution failed');
      }
    },
    {
      connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      concurrency: 5,
    },
  );
}
