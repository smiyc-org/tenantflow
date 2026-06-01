import type { ExternalTicketSystem } from '../enums.js';

export interface TicketDto {
  id: string;
  requestId: string;
  requestNumber: string;
  externalSystem?: ExternalTicketSystem;
  externalId?: string;
  externalUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
