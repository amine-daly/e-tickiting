// Backend-aligned API models

export type RoleType = 'ADMIN' | 'MANAGER' | 'DRIVER' | 'CUSTOMER';

export interface Phone { countryCode: string; number: string; }

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: RoleType;
  phone: Phone | null;
}

export interface AuthResponse { token: string; user: User; }

export interface PaginateResponse<T> {
  objects: T[];
  count: number;
  isLast: boolean;
}

export type ZoneTypesEnum = 'POINT' | 'POLYGON';
export interface LonLatType { type: ZoneTypesEnum; coordinates: number[]; }
export interface PlaceType { city: string; location: LonLatType; }

export interface Trip {
  id: string;
  source: PlaceType;
  destination: PlaceType;
  date: string; // ISO date yyyy-MM-dd
  price: number;
  availableSeats: number;
  seats?: Seat[];
}

export type SeatState = 'AVAILABLE' | 'RESERVED' | 'BLOCKED';
export interface Seat { row: number; col: number; state: SeatState; }

export interface SeatMapResponse { tripId: string; seats: Seat[]; }
export interface ReserveSeatsRequest { seats: { row: number; col: number }[]; }
export interface ReserveSeatsResponse { tripId: string; reserved: { row: number; col: number }[]; }
