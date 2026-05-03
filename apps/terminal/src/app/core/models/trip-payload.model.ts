import { GeoLocation } from './trip.model';

export interface StopInput {
  placeId: string;
  sequence: number;
  arrivalTime: string | null;
  departureTime: string | null;
  boardingAllowed: boolean;
  droppingAllowed: boolean;
}

export interface SegmentCreateInput {
  basePrice: number;
  maxBooking: number;
  distanceKm: number;
  durationMinutesOverride?: number;
}

export interface PickupPointPayload {
  placeId: string;
  address: string;
  scheduledDepartureTime: string;
  active?: boolean;
  location?: GeoLocation;
}

export interface DropoffPointPayload {
  placeId: string;
  address: string;
  scheduledArrivalTime: string;
  active?: boolean;
  location?: GeoLocation;
}

export interface ExpressSegmentCreateInput {
  segmentIndices: number[];
  price: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export interface ExpressSegmentPayload {
  fromPlaceId: string;
  toPlaceId: string;
  segmentIds: string[];
  price: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export interface ExpressSegmentUpdatePayload {
  price?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export interface TripCreatePayload {
  bus: { busId: string };
  departureDate: string;
  timezone: string;
  currencyId: string;
  stopSchedule: StopInput[];
  segmentInputs: SegmentCreateInput[];
  pickupPoints: PickupPointPayload[];
  dropoffPoints: DropoffPointPayload[];
  expressSegments?: ExpressSegmentCreateInput[];
}

export interface TripUpdatePayload {
  bus?: { busId: string };
  departureDate?: string;
  timezone?: string;
  currencyId?: string;
  stopSchedule?: StopInput[];
  pickupPoints?: PickupPointPayload[];
  dropoffPoints?: DropoffPointPayload[];
}
