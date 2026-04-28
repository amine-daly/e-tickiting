import { Picture, TargetType } from './shared.model';

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

export interface MarketplaceCompany {
  id: string | null;
  name: string | null;
  pictureUrl: string | null;
}

export interface MarketplaceRoutePoint {
  placeId: string;
  city: string;
}

export interface MarketplaceRoute {
  origin: MarketplaceRoutePoint;
  destination: MarketplaceRoutePoint;
}

export interface MarketplaceSchedule {
  departureDate: string;
  travelDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  durationMinutes: number;
}

export interface MarketplacePricing {
  displayPrice: number;
  currencyCode: string;
}

export interface MarketplaceCapacity {
  availableSeats: number;
}

import { AmenityEnum } from './amenity.enum';

export interface BusSummary {
  busId: string;
  name: string | null;
  totalSeats: number;
  amenities?: AmenityEnum[];
}

export interface CurrencySummary {
  id: string;
  code: string;
  name: string | null;
  iconFlag: string | null;
}

export interface CompanySummary {
  id: string;
  name: string | null;
  picture?: Picture | null;
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
  company?: CompanySummary | null;
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
  status: TripStatusEnum;
}

export interface TripDestinationForm {
  origin?: { city: string; id?: string };
  destination?: { city: string; id?: string };
  date?: string;
}

export interface TripRouteSelection {
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  date?: string | null;
}

export interface MarketplaceTrip {
  key: string;
  tripId: string;
  company: MarketplaceCompany;
  bus: BusSummary;
  route: MarketplaceRoute;
  schedule: MarketplaceSchedule;
  pricing: MarketplacePricing;
  capacity: MarketplaceCapacity;
  amenities?: AmenityEnum[];
}
