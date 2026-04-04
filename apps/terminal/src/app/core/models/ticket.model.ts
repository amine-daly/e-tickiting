export enum TicketStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface Ticket {
  id: string;
  tripId: string;
  companyId?: string | null;
  posId?: string | null;
  segmentIds: string[];
  expressId?: string | null;
  pickupPointId?: string | null;
  dropoffPointId?: string | null;
  passengerId: string;
  appliedPrice: number;
  currency: string;
  status: TicketStatus;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
}
