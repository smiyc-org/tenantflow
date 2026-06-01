export interface TicketInput {
  requestId: string;
  requestNumber: string;
  requesterUpn: string;
  workloadType: string;
  resourceDisplay: string;
  targetDisplay: string;
  permissionType: string;
  permissionAction: string;
  justification: string;
  ticketRef?: string;
}

export interface TicketUpdateInput {
  externalId: string;
  status: string;
  comment?: string;
}

export interface CreatedTicket {
  externalId: string;
  externalUrl?: string;
}

export interface ITicketAdapter {
  readonly systemName: string;
  createTicket(input: TicketInput): Promise<CreatedTicket>;
  updateTicket(input: TicketUpdateInput): Promise<void>;
  closeTicket(externalId: string, resolution: string): Promise<void>;
}
