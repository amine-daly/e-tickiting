// Clean filter input for searching trips
export interface TripFilterInput {
  originId?: string;
  destinationId?: string;
  date?: string; // ISO date string (yyyy-MM-dd)
  agencyId?: string;
}
