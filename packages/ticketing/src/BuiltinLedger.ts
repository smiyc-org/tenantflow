import type { ITicketAdapter, TicketInput, TicketUpdateInput, CreatedTicket } from './ITicketAdapter.js';

export interface LedgerDbClient {
  query(sql: string, params: unknown[]): Promise<{ rows: Array<{ id: string }> }>;
}

export class BuiltinLedger implements ITicketAdapter {
  readonly systemName = 'BUILTIN';

  constructor(private db: LedgerDbClient) {}

  async createTicket(input: TicketInput): Promise<CreatedTicket> {
    const result = await this.db.query(
      `INSERT INTO tickets (request_id, status)
       VALUES ($1, 'OPEN')
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id`,
      [input.requestId],
    );
    const id = result.rows[0]?.id ?? input.requestId;
    return { externalId: id };
  }

  async updateTicket(input: TicketUpdateInput): Promise<void> {
    await this.db.query(
      `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2`,
      [input.status, input.externalId],
    );
  }

  async closeTicket(externalId: string, resolution: string): Promise<void> {
    await this.db.query(
      `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2`,
      [resolution === 'GRANTED' ? 'CLOSED_GRANTED' : 'CLOSED_REJECTED', externalId],
    );
  }
}
