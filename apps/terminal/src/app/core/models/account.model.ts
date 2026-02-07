import { UserType, PhoneType } from './user-type';
import { PermissionType } from './permission-type';
import { CountryType } from './country-type';
import { StateType } from './state-type';

export interface RegisterAccountForTargetPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: PhoneType;
  password: string;
  role?: string;
  posId: string;
  permissionId?: string;
}

export interface PictureType {
  baseUrl?: string;
  path?: string;
}

export interface LonLatType {
  lng?: number | null;
  lat?: number | null;
}

export interface AddressType {
  addressLine?: string;
  city?: string;
  stateId?: string | null;
  countryId?: string | null;
  state?: StateType | null;
  country?: CountryType | null;
  zipCode?: string | null;
  location?: LonLatType | null;
}

export interface PointOfSaleType {
  id?: string;
  title?: string;
  subtitle?: string;
  picture?: PictureType | null;
  location?: AddressType | null;
  phone?: PhoneType | null;
  email?: string | null;
  emailTemplate?: string | null;
  currency?: CurrencyType;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AccountTarget {
  pos?: PointOfSaleType;
}

export interface TargetAciInput {
  pos?: string;
}

export interface CurrencyType {
  id?: string;
  name?: string;
  code?: string;
  iconFlag?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AccountType {
  id?: string;
  user: UserType;
  permission?: PermissionType;
  target?: AccountTarget;
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}
