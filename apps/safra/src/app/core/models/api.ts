/* Seat-map DTOs — backend endpoints are planned but not yet live.
   Keeping the interfaces so SeatService compiles.               */

export interface SeatCell {
  row: number;
  col: number;
  label: string;
  state: 'AVAILABLE' | 'RESERVED' | 'BLOCKED';
}

export interface SeatMapResponse {
  tripId: string;
  rows: number;
  cols: number;
  seats: SeatCell[];
}

export interface ReserveSeatsRequest {
  seats: { row: number; col: number }[];
}

export interface ReserveSeatsResponse {
  tripId: string;
  reserved: { row: number; col: number; label: string }[];
}
