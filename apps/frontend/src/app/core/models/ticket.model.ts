export enum TicketStatus {
  BOOKED = 'BOOKED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface TicketSeat {
  row: number;
  col: number;
  label?: string | null;
}

export interface TicketUserSnapshot {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface Ticket {
  id: string;
  tripId: string;
  userId: string;
  user?: TicketUserSnapshot | null;
  seats: TicketSeat[];
  status: TicketStatus;
  unitPrice?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  bookingReference?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
}
