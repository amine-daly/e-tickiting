export interface AgencyType {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
}
import { PlaceType } from 'src/app/modules/auth/models/place-type';

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
}
