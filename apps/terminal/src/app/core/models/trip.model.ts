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

export interface TripBusRef {
  busId: string;
}

export interface StopType {
  placeId: string;
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
  toPlaceId: string;
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
  toPlaceId: string;
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
  address: string;
  scheduledDepartureTime: string;
  active: boolean;
  location?: GeoLocation;
}

export interface DropoffPointType {
  pointId: string;
  placeId: string;
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
  bus: TripBusRef;
  currency: string;
  seatHoldMinutes: number;
  stopSchedule: StopType[];
  pickupPoints: PickupPointType[];
  dropoffPoints: DropoffPointType[];
  segments: SegmentType[];
  expressFares: ExpressFareType[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}
