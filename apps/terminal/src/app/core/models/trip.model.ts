import { PlaceType } from 'src/app/modules/auth/models/place-type';

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
}

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Trip {
  id: string;
  agency: AgencyType;
  origin: PlaceType;
  destination: PlaceType;
  departureDate: string;
  price: number;
  availableSeats: number;
  seats?: any[];
  version?: number;
  status: TripStatus;
}
