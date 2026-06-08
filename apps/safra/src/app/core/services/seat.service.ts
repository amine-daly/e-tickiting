import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ReserveSeatsRequest,
  ReserveSeatsResponse,
  SeatMapResponse,
} from '../models/api';

@Injectable({ providedIn: 'root' })
export class SeatService {
  private http = inject(HttpClient);

  getMap(tripId: string) {
    return this.http.get<SeatMapResponse>(`/api/trips/${tripId}/seats`);
  }

  putMap(
    tripId: string,
    payload: {
      seats: {
        row: number;
        col: number;
        state: 'AVAILABLE' | 'RESERVED' | 'BLOCKED';
      }[];
    }
  ) {
    return this.http.put<SeatMapResponse>(
      `/api/trips/${tripId}/seats`,
      payload
    );
  }

  reserve(tripId: string, payload: ReserveSeatsRequest) {
    return this.http.post<ReserveSeatsResponse>(
      `/api/trips/${tripId}/seats:reserve`,
      payload
    );
  }
}
