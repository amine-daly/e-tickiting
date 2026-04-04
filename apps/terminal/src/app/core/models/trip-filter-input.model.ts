import { TripStatusEnum } from './trip.model';

export interface TripFilterInput {
  status?: TripStatusEnum;
  departureDateFrom?: string;
  departureDateTo?: string;
  searchTerm?: string;
  page?: number;
  size?: number;
}
