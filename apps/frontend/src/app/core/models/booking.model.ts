export interface BookingRequest {
  tripId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId: string;
  idempotencyKey: string;
}

export interface BookingResponse {
  id: string;
  tripId: string;
  companyId: string;
  posId?: string;
  segmentIds: string[];
  expressSegmentId?: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId?: string;
  appliedPrice: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

export interface FrontofficeContactPassengerInput {
  firstName: string;
  lastName: string;
  email: string;
  seatNo?: string | null;
}

export interface FrontofficeGuestPassengerInput {
  firstName: string;
  lastName: string;
  seatNo?: string | null;
}

export interface FrontofficeCreateHoldRequest {
  holdToken: string;
  tripId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  lang?: string;
  contact: FrontofficeContactPassengerInput;
  passengers: FrontofficeGuestPassengerInput[];
}

export interface FrontofficeHoldContactSummary {
  passengerId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface FrontofficeHoldPassengerSummary {
  ticketId: string;
  passengerId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  seatNo?: string | null;
  appliedPrice?: number | null;
  currency?: string | null;
  status: string;
}

export interface FrontofficeHoldResponse {
  holdToken: string;
  groupBooking: boolean;
  tripId: string;
  companyId?: string | null;
  pickupPointId?: string | null;
  dropoffPointId?: string | null;
  segmentIds: string[];
  status: string;
  totalPrice: number;
  currency: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  contact?: FrontofficeHoldContactSummary | null;
  passengers: FrontofficeHoldPassengerSummary[];
}

export interface FrontofficeBookingDraft {
  holdToken?: string | null;
  tripId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  displayPrice: number;
  currencyCode: string;
  passengerCount: number;
  selectedSeatNos: string[];
}