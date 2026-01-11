import { CountryType } from './country-type';
import { StateType } from './state-type';

export enum PlaceKindEnum {
  CITY = 'CITY',
  POINT = 'POINT',
}

export interface LonLatType {
  type?: string | null;
  coordinates: [number, number]; // [lng, lat]
}

/** Sub-place (pickup/dropoff point) inside a city */
export interface SubPlaceType {
  id?: string;
  address?: string;
  kind?: PlaceKindEnum;
  location?: LonLatType;
  pickupInstructions?: string;
  isDefault?: boolean;
  /** Parent place ID (for linking back to the city) */
  parentId?: string;
  /** Parent city name (for display purposes) */
  parentCity?: string;
}

export interface PlaceType {
  id?: string;
  city: string;
  kind?: PlaceKindEnum;
  state?: StateType;
  country?: CountryType;
  /** Sub-places (pickup/dropoff points) - only for CITY places */
  subPlaces?: SubPlaceType[];
}
