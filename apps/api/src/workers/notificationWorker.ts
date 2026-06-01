import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '@tenantflow/shared';
import { EmailSender } from '@tenantflow/reporting';
import type pg from 'pg';
import { config } from '../config.js';

interface NotificationJob {
  type: string;
  requestId: string;
  stageIndex?: number;
}

export function startNotificationWorker(db: pg.Pool): Worker {
  const emailSender = new EmailSender({
    fromAddress: config.email.from,
    smtpHost: config.email.smtpHost || undefined,
    smtpPort: config.email.smtpPort,
    smtpUser: config.email.smtpUser || undefined,
    smtpPassword: config.email.smtpPassword || undefined,
  });

  return new Worker<NotificationJob>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJob>) => {
      const { requestId, stageIndex } = job.data;

      const res = await db.query(
        `SELECT r.*, u.upn AS requester_upn, u.display_name AS requester_display
         FROM requests r JOIN users u ON u.id = r.requester_id
         WHERE r.id = $1`,
        [requestId],
      );
      const request = res.rows[0] as Record<string, string> | undefined;
      if (!request) return;

      if (stageIndex) {
        // Find approver for this stage
        const stageRes = await db.query(
          `SELECT ast.*, u.email AS approver_email, u.display_name AS approver_display
           FROM approval_stages ast JOIN users u ON u.id = ast.approver_id
           WHERE ast.request_id = $1 AND ast.stage_index = $2 AND ast.is_active = TRUE`,
          [requestId, stageIndex],
        );
        const stage = stageRes.rows[0] as { approver_email: string; token: string } | undefined;
        if (!stage?.approver_email) return;

        await emailSender.send({
          to: [stage.approver_email],
          subject: `[TenantFloe] Approval Required — ${request['request_number']}`,
          html: buildApprovalEmailHtml(request, stage.token, config.apiBaseUrl),
        });
      }
    },
    {
      connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      concurrency: 10,
    },
  );
}

function buildApprovalEmailHtml(
  request: Record<string, string>,
  token: string,
  baseUrl: string,
): string {
  const approveUrl = `${baseUrl}/approvals/${token}/approve`;
  const rejectUrl = `${baseUrl}/approvals/${token}/reject`;
  const detailUrl = `${baseUrl}/requests/${request['id']}`;

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333">
  <h2>Access Request Requires Your Approval</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px;font-weight:bold">Request #</td><td>${request['request_number']}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Requester</td><td>${request['requester_display']} (${request['requester_upn']})</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Workload</td><td>${request['workload_type']}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Resource</td><td>${request['resource_display']}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Action</td><td>${request['permission_action']} ${request['permission_type']} for ${request['target_display']}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Justification</td><td>${request['justification']}</td></tr>
    ${request['access_end'] ? `<tr><td style="padding:8px;font-weight:bold">Access Until</td><td>${request['access_end']}</td></tr>` : ''}
  </table>
  <div style="margin-top:24px">
    <a href="${approveUrl}" style="background:#107c10;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;margin-right:8px">✓ Approve</a>
    <a href="${rejectUrl}" style="background:#d13438;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;margin-right:8px">✗ Reject</a>
    <a href="${detailUrl}" style="background:#0078d4;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">View Details</a>
  </div>
  <p style="font-size:11px;color:#999;margin-top:32px">This approval link expires in 72 hours.</p>
</body>
</html>`;
}
