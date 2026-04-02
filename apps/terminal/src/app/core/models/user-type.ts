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
  role: RoleEnum;
  picture?: any | null;
  app?: string | null;
  target?: { company?: { id?: string }; pos?: { id?: string } } | null;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
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

export enum RoleEnum {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DRIVER = 'DRIVER',
  CUSTOMER = 'CUSTOMER',
}
