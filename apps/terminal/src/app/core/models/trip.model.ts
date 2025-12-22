import { PlaceType } from 'src/app/core/models/place-type';
import { TripRouteSnapshot } from './route.model';

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
