import { PlaceType, SubPlaceType } from 'src/app/core/models/place-type';
import { CountryType } from './country-type';
import { StateType } from './state-type';

export interface AgencyPhone {
  countryCode: string;
  number: string;
}

export interface AgencyType {
  id?: string;
  name: string;
  address: string;
  email?: string;
  phone: AgencyPhone;
  template?: string;
}

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Intermediate stop with place, rank, and fare
export interface StopType {
  placeId: string;
  rank: number;
  fare: number;
  place?: PlaceType; // Expanded place from backend
}

/** Per-trip sub-place selection with scheduled time */
export interface TripSubPlaceInput {
  subPlaceId: string;
  scheduledTime?: string; // ISO datetime
}

/** Expanded pickup point returned by the backend */
export interface ExpandedPickupPoint {
  subPlaceId: string;
  scheduledTime?: string;
  address?: string;
  location?: { coordinates: [number, number] };
  pickupInstructions?: string;
  parentId?: string;
}

/** Extended place with state, country, and sub-places (pickup/dropoff points) */
export interface TripPlaceType {
  id?: string;
  city: string;
  location?: { coordinates: [number, number] };
  state?: StateType;
  country?: CountryType;
  /** Sub-places (pickup/dropoff points) */
  places?: SubPlaceType[];
}

export interface TripType {
  id: string;
  agency: AgencyType;
  agencyId?: string;
  originId: string;
  destinationId: string;
  origin?: TripPlaceType;
  destination?: TripPlaceType;
  stops?: StopType[]; // Intermediate stops with placeId, rank, fare
  pickupPoints?: TripSubPlaceInput[]; // Selected sub-places with per-trip scheduled times
  departureDate: string; // ISO datetime with timezone
  totalPrice: number;
  totalPlaces: number;
  availableSeats: number;
  seats?: any[];
  version?: number;
  status: TripStatus;
  createdAt?: string;
  updatedAt?: string;
}
