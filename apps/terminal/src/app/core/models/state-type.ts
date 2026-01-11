import { CountryType } from './country-type';

export interface StateType {
  id?: string;
  name: string;
  code: string;
  countryId?: string;
  country?: CountryType;
}
