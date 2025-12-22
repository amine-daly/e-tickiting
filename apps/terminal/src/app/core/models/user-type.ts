export interface PhoneType {
  countryCode: string;
  number: string;
}

export interface UserType {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: PhoneType | null;
  role: string; // RoleType enum string from backend
  createdAt?: string; // ISO date string
}

// Minimal auth response mapping convenience
export interface AuthResponseModel {
  token: string;
  user: UserType;
}

export enum AppsEnum {
  FRONT = 'FRONT',
  TERMINAL = 'TERMINAL',
}
