import { PlaceType } from './place-type';

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

// Snapshot of a route embedded in a trip (intermediate stops)
export interface TripRouteSnapshot {
  id: string;
  originId: string;
  destinationId: string;
  rank: number;
  fare: number; // BigDecimal in backend
}

export interface TripType {
  id: string;
  agency: AgencyType;
  agencyId?: string;
  originId: string; // Admin-entered origin place ID
  destinationId: string; // Admin-entered destination place ID
  origin?: PlaceType; // Populated from originId
  destination?: PlaceType; // Populated from destinationId
  stops?: TripRouteSnapshot[]; // Optional intermediate stops
  departureDate: string; // ISO datetime with timezone
  totalPrice: number; // Admin-entered total price
  availableSeats: number;
  seats?: any[];
  version?: number;
  status: TripStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripSearchParams {
  originId: string;
  destinationId: string;
  date?: string; // yyyy-MM-dd
}
// Clean filter input for searching trips
export interface TripFilterInput {
  originId?: string;
  destinationId?: string;
  date?: string; // ISO date string (yyyy-MM-dd)
  agencyId?: string;
}
// Clean filter input for searching trips
export interface TripDestinationForm {
  origin?: { city: string };
  destination?: { city: string };
  date?: string;
}
