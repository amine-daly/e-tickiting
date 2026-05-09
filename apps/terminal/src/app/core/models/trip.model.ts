import { CurrencyType } from './account.model';
import { TargetType } from './shared.model';

export enum TripStatusEnum {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface PlaceSummary {
  id: string;
  city: string | null;
}

export interface BusSummary {
  busId: string;
  name: string | null;
  totalSeats: number;
}

export interface StopType {
  placeId: string;
  place?: PlaceSummary;
  sequence: number;
  arrivalTime: string | null;
  departureTime: string | null;
  boardingAllowed: boolean;
  droppingAllowed: boolean;
}

export interface SegmentType {
  segmentId: string;
  sequence: number;
  fromPlaceId?: string | null;
  fromPlace?: PlaceSummary;
  toPlaceId?: string | null;
  toPlace?: PlaceSummary;
  departureTime: string;
  arrivalTime: string;
  maxBooking: number;
  bookedCount: number;
  basePrice: number;
  distanceKm: number;
  durationMinutes: number;
}

export interface ExpressSegmentType {
  expressSegmentId: string;
  fromPlaceId?: string | null;
  fromPlace?: PlaceSummary;
  toPlaceId?: string | null;
  toPlace?: PlaceSummary;
  segmentsCovered: string[];
  price: number;
  bookedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
}

export interface PickupPointType {
  pointId: string;
  placeId: string;
  place?: PlaceSummary;
  address: string;
  scheduledDepartureTime: string;
  active: boolean;
  location?: GeoLocation;
}

export interface DropoffPointType {
  pointId: string;
  placeId: string;
  place?: PlaceSummary;
  address: string;
  scheduledArrivalTime: string;
  active: boolean;
  location?: GeoLocation;
}

export interface TripType {
  id: string;
  target: TargetType;
  departureDate: string;
  timezone: string;
  status: TripStatusEnum;
  bus: BusSummary;
  currency?: CurrencyType;
  stopSchedule: StopType[];
  pickupPoints: PickupPointType[];
  dropoffPoints: DropoffPointType[];
  segments: SegmentType[];
  expressSegments: ExpressSegmentType[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface TripRouteAvailabilityType {
  tripId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  sellable: boolean;
  requiresExpressSegment: boolean;
  availableSeats: number;
  displayPrice: number;
  currencyCode: string;
  expressSegmentId?: string | null;
  segmentIds: string[];
}
