import type { ITicketAdapter, TicketInput, TicketUpdateInput, CreatedTicket } from '../ITicketAdapter.js';

export interface JiraConfig {
  baseUrl: string;
  userEmail: string;
  apiToken: string;
  projectKey: string;
  issueType?: string;
}

export class JiraAdapter implements ITicketAdapter {
  readonly systemName = 'JIRA';
  private issueType: string;

  constructor(private config: JiraConfig) {
    this.issueType = config.issueType ?? 'Task';
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.config.userEmail}:${this.config.apiToken}`).toString('base64');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/rest/api/3/${path}`, {
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
      throw new Error(`Jira ${method} ${path} failed (${res.status}): ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async createTicket(input: TicketInput): Promise<CreatedTicket> {
    const body = {
      fields: {
        project: { key: this.config.projectKey },
        issuetype: { name: this.issueType },
        summary: `[AccessConcierge] ${input.requestNumber} — ${input.permissionAction} ${input.permissionType} on ${input.resourceDisplay}`,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: [
                    `Requester: ${input.requesterUpn}`,
                    `Target: ${input.targetDisplay}`,
                    `Workload: ${input.workloadType}`,
                    `Justification: ${input.justification}`,
                    input.ticketRef ? `Related ticket: ${input.ticketRef}` : '',
                  ].filter(Boolean).join('\n'),
                },
              ],
            },
          ],
        },
        labels: ['access-concierge', input.workloadType.toLowerCase()],
      },
    };

    const data = await this.request<{ id: string; key: string; self: string }>('POST', 'issue', body);

    return {
      externalId: data.key,
      externalUrl: `${this.config.baseUrl}/browse/${data.key}`,
    };
  }

  async updateTicket(input: TicketUpdateInput): Promise<void> {
    await this.request('POST', `issue/${input.externalId}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: input.comment ?? `Status: ${input.status}` }],
          },
        ],
      },
    });
  }

  async closeTicket(externalId: string, resolution: string): Promise<void> {
    const transitionId = resolution === 'GRANTED' ? '31' : '41';
    await this.request('POST', `issue/${externalId}/transitions`, {
      transition: { id: transitionId },
      update: {
        comment: [
          {
            add: {
              body: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: `Resolved: ${resolution}` }] },
                ],
              },
            },
          },
        ],
      },
    });
  }
}
