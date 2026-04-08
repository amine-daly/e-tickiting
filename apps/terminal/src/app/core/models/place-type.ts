import { CountryType } from './country-type';
import { StateType } from './state-type';

export enum PlaceKindEnum {
  CITY = 'CITY',
}

export interface PlaceType {
  id?: string;
  city: string;
  kind?: PlaceKindEnum;
  state?: StateType;
  country?: CountryType;
}
