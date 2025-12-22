import { PlaceType } from './place-type';

export interface RouteType {
  id?: string;
  origin?: PlaceType;
  destination?: PlaceType;
  originId?: string;
  destinationId?: string;
  fare: number; // BigDecimal in backend, number in frontend (in TND)
  rank?: number;
  active: boolean;
}

export interface RouteCoefficient {
  id?: string;
  routeId?: string | null; // null for global
  startDate: string;
  endDate: string;
  coefficient: number;
  name?: string;
  priority: number;
  active: boolean;
}

// Snapshot of a route embedded in a trip
export interface TripRouteSnapshot {
  id: string;
  originId: string;
  destinationId: string;
  rank: number;
  fare: number; // BigDecimal in backend
}

// Legacy interface - kept for backward compatibility during migration
export interface Fare {
  fromIndex: number;
  toIndex: number;
  priceCents: number;
  manual: boolean;
}
