import type { ITicketAdapter, TicketInput } from './ITicketAdapter.js';
import type { BuiltinLedger } from './BuiltinLedger.js';

export interface TicketingResult {
  builtinId: string;
  externalSystem?: string;
  externalId?: string;
  externalUrl?: string;
}

export class TicketingService {
  constructor(
    private ledger: BuiltinLedger,
    private externalAdapter?: ITicketAdapter,
  ) {}

  async createTicket(input: TicketInput): Promise<TicketingResult> {
    const builtin = await this.ledger.createTicket(input);
    const result: TicketingResult = { builtinId: builtin.externalId };

    if (this.externalAdapter) {
      try {
        const external = await this.externalAdapter.createTicket(input);
        result.externalSystem = this.externalAdapter.systemName;
        result.externalId = external.externalId;
        result.externalUrl = external.externalUrl;
      } catch (err) {
        // Log but don't fail — built-in ledger is the source of truth
        console.error(`External ticketing (${this.externalAdapter.systemName}) failed:`, err);
      }
    }

    return result;
  }

  async closeTicket(builtinId: string, externalId: string | undefined, resolution: string): Promise<void> {
    await this.ledger.closeTicket(builtinId, resolution);

    if (this.externalAdapter && externalId) {
      try {
        await this.externalAdapter.closeTicket(externalId, resolution);
      } catch (err) {
        console.error(`External ticket close failed:`, err);
      }
    }
  }
}
