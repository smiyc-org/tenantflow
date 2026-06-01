import type { ITicketAdapter, TicketInput, TicketUpdateInput, CreatedTicket } from '../ITicketAdapter.js';

export interface ServiceNowConfig {
  baseUrl: string;
  username: string;
  password: string;
  table?: string;
}

export class ServiceNowAdapter implements ITicketAdapter {
  readonly systemName = 'SERVICENOW';
  private table: string;

  constructor(private config: ServiceNowConfig) {
    this.table = config.table ?? 'incident';
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/api/now/table/${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ServiceNow ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async createTicket(input: TicketInput): Promise<CreatedTicket> {
    const body = {
      short_description: `[AccessConcierge] ${input.permissionAction} ${input.permissionType} on ${input.resourceDisplay}`,
      description: [
        `Request: ${input.requestNumber}`,
        `Requester: ${input.requesterUpn}`,
        `Target: ${input.targetDisplay}`,
        `Workload: ${input.workloadType}`,
        `Justification: ${input.justification}`,
        input.ticketRef ? `Related ticket: ${input.ticketRef}` : '',
      ].filter(Boolean).join('\n'),
      caller_id: input.requesterUpn,
      category: 'Access Management',
      subcategory: input.workloadType,
    };

    const data = await this.request<{ result: { sys_id: string; number: string } }>(
      'POST',
      this.table,
      body,
    );

    return {
      externalId: data.result.sys_id,
      externalUrl: `${this.config.baseUrl}/nav_to.do?uri=${this.table}.do?sys_id=${data.result.sys_id}`,
    };
  }

  async updateTicket(input: TicketUpdateInput): Promise<void> {
    await this.request('PATCH', `${this.table}/${input.externalId}`, {
      work_notes: input.comment ?? `Status updated to ${input.status}`,
      state: this.mapStatus(input.status),
    });
  }

  async closeTicket(externalId: string, resolution: string): Promise<void> {
    await this.request('PATCH', `${this.table}/${externalId}`, {
      state: '7', // Closed
      close_code: 'Solved (Permanently)',
      close_notes: `Access request resolved: ${resolution}`,
    });
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      OPEN: '1',
      IN_PROGRESS: '2',
      APPROVED: '3',
      EXECUTING: '4',
      CLOSED_GRANTED: '7',
      CLOSED_REJECTED: '7',
    };
    return map[status] ?? '1';
  }
}
