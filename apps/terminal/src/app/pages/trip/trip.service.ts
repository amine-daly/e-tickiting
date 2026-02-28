import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { TripType as TripType, TripStatus } from '../../core/models/trip.model';
import { TripFilterInput } from 'src/app/core/models/trip-filter-input.model';
import {
  IPagination,
  PaginateResponse,
} from 'src/app/core/models/paginate-model';

// Stop input for creating/updating a trip
export interface StopInput {
  placeId: string;
  rank?: number;
  fare?: number;
}

// Sub-place input for per-trip pickup/dropoff point scheduling
export interface SubPlaceInput {
  subPlaceId: string;
  scheduledTime?: string; // ISO datetime
}

export interface TripCreatePayload {
  agencyId?: string | null;
  originId: string;
  destinationId: string;
  totalPrice: number;
  stops?: StopInput[];
  pickupPoints?: SubPlaceInput[];
  departureDate: string;
  totalPlaces: number;
  status?: TripStatus | null;
}

export interface TripUpdatePayload {
  agencyId?: string | null;
  originId?: string | null;
  destinationId?: string | null;
  totalPrice?: number | null;
  stops?: StopInput[] | null;
  pickupPoints?: SubPlaceInput[] | null;
  departureDate?: string | null;
  totalPlaces?: number | null;
  status?: TripStatus | null;
}

@Injectable({ providedIn: 'root' })
export class TripService {
  private loading = new BehaviorSubject<boolean>(false);
  private trips = new BehaviorSubject<TripType[]>([]);
  private pagination = new BehaviorSubject<IPagination>(null);
  private baseUrl = '/api/trips';

  get trips$(): Observable<TripType[]> {
    return this.trips.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  pageLimit = 10;
  pageIndex = 0;

  constructor(private http: HttpClient) {}

  getTripById(id: string): Observable<TripType> {
    return this.http.get<TripType>(`${this.baseUrl}/${id}`);
  }

  getTrips(filter: TripFilterInput): Observable<TripType[]> {
    this.loading.next(true);
    const params: Record<string, any> = {
      page: this.pageIndex,
      limit: this.pageLimit,
      posId: localStorage.getItem('posId'),
      ...(filter?.originId ? { originId: filter.originId } : {}),
      ...(filter?.destinationId ? { destinationId: filter.destinationId } : {}),
      ...(filter?.date ? { date: filter.date } : {}),
      ...(filter?.agencyId ? { agencyId: filter.agencyId } : {}),
    };

    return this.http
      .get<PaginateResponse<TripType>>(`${this.baseUrl}/search`, { params })
      .pipe(
        map((data) => {
          const objects = Array.isArray(data?.objects) ? data.objects : [];
          const count = data?.count ?? objects.length;
          this.trips.next(objects);
          this.pagination.next({
            length: count,
            size: this.pageLimit,
            page: this.pageIndex,
            lastPage: Math.max(0, Math.ceil(count / this.pageLimit) - 1),
          });
          return objects;
        }),
        catchError((error) => {
          this.trips.next([]);
          this.pagination.next({
            length: 0,
            size: this.pageLimit,
            page: this.pageIndex,
            lastPage: 0,
          });
          return throwError(() => error);
        }),
        finalize(() => this.loading.next(false)),
      );
  }

  createTrip(payload: TripCreatePayload): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/create`, {
        ...payload,
        target: { pos: localStorage.getItem('posId') },
      })
      .pipe(
        map((created: TripType) => {
          const current = this.trips.value ?? [];
          const nextList = [...current, created];
          this.trips.next(nextList);

          const currentPagination =
            this.pagination.value ??
            ({
              length: current.length ?? nextList.length,
              size: this.pageLimit,
              page: this.pageIndex,
              lastPage: 0,
            } as IPagination);
          const newLength = (currentPagination.length ?? nextList.length) + 1;
          const newLastPage = Math.max(
            0,
            Math.ceil(newLength / this.pageLimit) - 1,
          );
          this.pagination.next({
            length: newLength,
            size: this.pageLimit,
            page: this.pageIndex,
            lastPage: newLastPage,
          });

          return created;
        }),
      );
  }

  generateSeats(id: string): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/${id}/seats/generate`, {})
      .pipe(
        map((updated: TripType) => {
          return updated;
        }),
      );
  }

  updateTrip(id: string, changes: TripUpdatePayload): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/update/${id}`, changes)
      .pipe(
        map((updated: TripType) => {
          const updatedList = (this.trips.value ?? []).map((trip) =>
            trip.id === id ? { ...trip, ...updated } : trip,
          );
          this.trips.next(updatedList);

          const currentPagination =
            this.pagination.value ??
            ({
              length: updatedList.length,
              size: this.pageLimit,
              page: this.pageIndex,
              lastPage: 0,
            } as IPagination);
          const newLength = currentPagination.length ?? updatedList.length;
          const newLastPage = Math.max(
            0,
            Math.ceil(newLength / this.pageLimit) - 1,
          );
          this.pagination.next({
            length: newLength,
            size: this.pageLimit,
            page: this.pageIndex,
            lastPage: newLastPage,
          });

          return updated;
        }),
      );
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete/${id}`).pipe(
      tap(() => {
        const filtered = (this.trips.value ?? []).filter(
          (trip) => trip.id !== id,
        );
        this.trips.next(filtered);

        const currentPagination =
          this.pagination.value ??
          ({
            length: (this.trips.value ?? filtered).length,
            size: this.pageLimit,
            page: this.pageIndex,
            lastPage: 0,
          } as IPagination);
        const newLength = Math.max(
          0,
          (currentPagination.length ?? filtered.length + 1) - 1,
        );
        const newLastPage = Math.max(
          0,
          Math.ceil(newLength / this.pageLimit) - 1,
        );
        this.pagination.next({
          length: newLength,
          size: this.pageLimit,
          page: this.pageIndex,
          lastPage: newLastPage,
        });
      }),
    );
  }
}
