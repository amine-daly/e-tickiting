import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { Trip as TripType, TripStatus } from '../../core/models/trip.model';
import { PaginateResponse } from '../../core/models/paginate-response.model';
import { TripFilterInput } from 'src/app/modules/auth/models/trip-filter-input.model';

export interface TripCreatePayload {
  agencyId?: string | null;
  originId: string;
  destinationId: string;
  departureDate: string;
  price: number;
  availableSeats: number;
  status?: TripStatus | null;
}

export interface TripUpdatePayload {
  agencyId?: string | null;
  originId?: string | null;
  destinationId?: string | null;
  departureDate?: string | null;
  price?: number | null;
  availableSeats?: number | null;
  status?: TripStatus | null;
}

@Injectable({ providedIn: 'root' })
export class TripService {
  private loading = new BehaviorSubject<boolean>(false);
  private trips = new BehaviorSubject<TripType[]>([]);
  private baseUrl = '/api/trips';

  get trips$(): Observable<TripType[]> {
    return this.trips.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  constructor(private http: HttpClient) {}

  getTrips(filter: TripFilterInput): Observable<PaginateResponse<TripType>> {
    this.loading.next(true);
    const params: Record<string, any> = {
      ...filter,
      page: 0,
      limit: 200,
    };
    Object.keys(params).forEach((key) => {
      if (
        params[key] === undefined ||
        params[key] === null ||
        params[key] === ''
      ) {
        delete params[key];
      }
    });

    return this.http
      .get<PaginateResponse<TripType>>(`${this.baseUrl}/search`, { params })
      .pipe(
        map((data) => {
          const objects = Array.isArray(data?.objects) ? data.objects : [];
          this.trips.next(objects);
          return data;
        }),
        catchError((error) => {
          this.trips.next([]);
          return throwError(() => error);
        }),
        finalize(() => this.loading.next(false))
      );
  }

  createTrip(payload: TripCreatePayload): Observable<TripType> {
    return this.http.post<TripType>(`${this.baseUrl}/create`, payload).pipe(
      map((created: TripType) => {
        const current = this.trips.value ?? [];
        this.trips.next([...current, created]);
        return created;
      })
    );
  }

  updateTrip(id: string, changes: TripUpdatePayload): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/update/${id}`, changes)
      .pipe(
        map((updated: TripType) => {
          const updatedList = (this.trips.value ?? []).map((trip) =>
            trip.id === id ? { ...trip, ...updated } : trip
          );
          this.trips.next(updatedList);
          return updated;
        })
      );
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete/${id}`).pipe(
      tap(() => {
        const filtered = (this.trips.value ?? []).filter(
          (trip) => trip.id !== id
        );
        this.trips.next(filtered);
      })
    );
  }
}
