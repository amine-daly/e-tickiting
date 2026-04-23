import { TargetType } from './shared.model';

export { TargetType };

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

export interface CurrencySummary {
  id: string;
  code: string;
  name: string | null;
  iconFlag: string | null;
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
  fromPlaceId: string;
  fromPlace?: PlaceSummary;
  toPlaceId: string;
  toPlace?: PlaceSummary;
  departureTime: string;
  arrivalTime: string;
  maxSeats: number;
  bookedSeats: number;
  basePrice: number;
  distanceKm: number;
  durationMinutes: number;
}

export interface ExpressFareType {
  expressId: string;
  fromPlaceId: string;
  fromPlace?: PlaceSummary;
  toPlaceId: string;
  toPlace?: PlaceSummary;
  segmentsCovered: string[];
  price: number;
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
  currency?: CurrencySummary;
  stopSchedule: StopType[];
  pickupPoints: PickupPointType[];
  dropoffPoints: DropoffPointType[];
  segments: SegmentType[];
  expressFares: ExpressFareType[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface TripSearchParams {
  originPlaceId?: string;
  destinationPlaceId?: string;
  date?: string;
  companyId?: string;
  status?: string;
}

export interface TripDestinationForm {
  origin?: { city: string; id?: string };
  destination?: { city: string; id?: string };
  date?: string;
}
