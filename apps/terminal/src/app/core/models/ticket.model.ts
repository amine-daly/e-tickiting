export enum TicketStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface TicketUserPhone {
  countryCode?: string | null;
  number?: string | null;
}

export interface TicketUserPicture {
  baseUrl?: string | null;
  path?: string | null;
}

export interface TicketUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  picture?: TicketUserPicture | null;
  phone?: TicketUserPhone | null;
}

export interface Ticket {
  id: string;
  tripId: string;
  orderId?: string | null;
  companyId?: string | null;
  posId?: string | null;
  segmentIds: string[];
  expressSegmentId?: string | null;
  pickupPointId?: string | null;
  dropoffPointId?: string | null;
  passengerId?: string | null;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  seatNo?: string | null;
  appliedPrice: number;
  currency: string;
  lang?: string | null;
  status: TicketStatus;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  // Enriched fields from backend
  originCity?: string | null;
  destinationCity?: string | null;
  pickupCity?: string | null;
  dropoffCity?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  tripDepartureDate?: string | null;
  tripStatus?: string | null;
  user?: TicketUser | null;
}
