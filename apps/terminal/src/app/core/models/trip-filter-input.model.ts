import { TripStatusEnum } from './trip.model';

export type TripSortBy = 'createdAt' | 'departureDate';
export type TripSortOrder = 'asc' | 'desc';

export interface TripFilterInput {
  status?: TripStatusEnum;
  departureDateFrom?: string;
  departureDateTo?: string;
  searchTerm?: string;
  sortBy?: TripSortBy;
  order?: TripSortOrder;
  page?: number;
  size?: number;
}
