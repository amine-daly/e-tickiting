import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  TripType,
  TripStatusEnum,
  TripRouteAvailabilityType,
} from '../../core/models/trip.model';
import {
  TripFilterInput,
  TripSortBy,
  TripSortOrder,
} from 'src/app/core/models/trip-filter-input.model';
import {
  DropoffPointPayload,
  ExpressSegmentPayload,
  ExpressSegmentUpdatePayload,
  PickupPointPayload,
  TripCreatePayload,
  TripUpdatePayload,
} from '../../core/models/trip-payload.model';
import {
  IPagination,
  PaginateResponse,
} from 'src/app/core/models/paginate-model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private loading = new BehaviorSubject<boolean>(false);
  private trips = new BehaviorSubject<TripType[]>([]);
  private trip = new BehaviorSubject<TripType>(null);
  private pagination = new BehaviorSubject<IPagination>(null);
  private baseUrl = `${environment.apiBase}/trips`;

  get trips$(): Observable<TripType[]> {
    return this.trips.asObservable();
  }

  get trip$(): Observable<TripType> {
    return this.trip.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  pageLimit = 10;
  pageIndex = 0;
  private readonly defaultSortBy: TripSortBy = 'createdAt';
  private readonly defaultSortOrder: TripSortOrder = 'desc';

  constructor(private http: HttpClient) {}

  // ─── LIST ────────────────────────────────────────────────
  tripList(filter: TripFilterInput = {}): Observable<TripType[]> {
    this.loading.next(true);
    const sortBy = filter.sortBy ?? this.defaultSortBy;
    const order = filter.order ?? this.defaultSortOrder;
    let params = new HttpParams()
      .set('page', this.pageIndex)
      .set('limit', this.pageLimit)
      .set('sortBy', sortBy)
      .set('order', order);
    let endpoint = this.baseUrl;

    if (filter.status) {
      params = params.set('status', filter.status);
    }

    if (filter.searchTerm?.trim()) {
      endpoint = `${this.baseUrl}/search`;
      params = params.set('searchTerm', filter.searchTerm.trim());
    }

    return this.http.get<PaginateResponse<TripType>>(endpoint, { params }).pipe(
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

  // ─── GET BY ID ───────────────────────────────────────────
  getById(id: string): Observable<TripType> {
    return this.http
      .get<TripType>(`${this.baseUrl}/${id}`)
      .pipe(tap((trip) => this.trip.next(trip)));
  }

  getRouteAvailability(
    tripId: string,
    originPlaceId: string,
    destinationPlaceId: string,
  ): Observable<TripRouteAvailabilityType> {
    const params = new HttpParams()
      .set('originPlaceId', originPlaceId)
      .set('destinationPlaceId', destinationPlaceId);

    return this.http.get<TripRouteAvailabilityType>(
      `${this.baseUrl}/${tripId}/route-availability`,
      { params },
    );
  }

  // ─── CREATE ──────────────────────────────────────────────
  create(payload: TripCreatePayload): Observable<TripType> {
    return this.http.post<TripType>(this.baseUrl, payload).pipe(
      tap((created) => {
        const current = this.trips.value ?? [];
        this.trips.next([created, ...current]);
      }),
    );
  }

  // ─── UPDATE ──────────────────────────────────────────────
  update(
    id: string,
    changes: Partial<TripUpdatePayload>,
  ): Observable<TripType> {
    return this.http.put<TripType>(`${this.baseUrl}/${id}`, changes).pipe(
      tap((updated) => {
        this.trip.next(updated);
        const updatedList = (this.trips.value ?? []).map((t) =>
          t.id === id ? updated : t,
        );
        this.trips.next(updatedList);
      }),
    );
  }

  // ─── DELETE ──────────────────────────────────────────────
  delete(id: string): Observable<void> {
    if (!id) return of(undefined);
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const filtered = (this.trips.value ?? []).filter((t) => t.id !== id);
        this.trips.next(filtered);
      }),
    );
  }

  // ─── STATUS TRANSITION ──────────────────────────────────
  updateStatus(id: string, status: TripStatusEnum): Observable<TripType> {
    return this.http
      .patch<TripType>(`${this.baseUrl}/${id}/status`, { status })
      .pipe(
        tap((updated) => {
          this.trip.next(updated);
          const updatedList = (this.trips.value ?? []).map((t) =>
            t.id === id ? updated : t,
          );
          this.trips.next(updatedList);
        }),
      );
  }

  // ─── SEGMENT FIELD UPDATES ──────────────────────────────
  updateSegmentPrice(
    tripId: string,
    segmentId: string,
    basePrice: number,
  ): Observable<TripType> {
    return this.http
      .patch<TripType>(
        `${this.baseUrl}/${tripId}/segments/${segmentId}/price`,
        { basePrice },
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  updateSegmentMaxBooking(
    tripId: string,
    segmentId: string,
    maxBooking: number,
  ): Observable<TripType> {
    return this.http
      .patch<TripType>(
        `${this.baseUrl}/${tripId}/segments/${segmentId}/max-booking`,
        { maxBooking },
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  // ─── EXPRESS SEGMENT SUB-RESOURCE ───────────────────────
  addExpressSegment(
    tripId: string,
    expressSegment: ExpressSegmentPayload,
  ): Observable<TripType> {
    return this.http
      .post<TripType>(
        `${this.baseUrl}/${tripId}/express-segments`,
        expressSegment,
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  updateExpressSegment(
    tripId: string,
    expressSegmentId: string,
    changes: ExpressSegmentUpdatePayload,
  ): Observable<TripType> {
    return this.http
      .put<TripType>(
        `${this.baseUrl}/${tripId}/express-segments/${expressSegmentId}`,
        changes,
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  deleteExpressSegment(
    tripId: string,
    expressSegmentId: string,
  ): Observable<TripType> {
    return this.http
      .delete<TripType>(
        `${this.baseUrl}/${tripId}/express-segments/${expressSegmentId}`,
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  // ─── PICKUP POINT SUB-RESOURCE ──────────────────────────
  addPickupPoint(
    tripId: string,
    point: PickupPointPayload,
  ): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/${tripId}/pickup-points`, point)
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  updatePickupPoint(
    tripId: string,
    pointId: string,
    changes: Partial<PickupPointPayload>,
  ): Observable<TripType> {
    return this.http
      .put<TripType>(
        `${this.baseUrl}/${tripId}/pickup-points/${pointId}`,
        changes,
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  // ─── DROPOFF POINT SUB-RESOURCE ─────────────────────────
  addDropoffPoint(
    tripId: string,
    point: DropoffPointPayload,
  ): Observable<TripType> {
    return this.http
      .post<TripType>(`${this.baseUrl}/${tripId}/dropoff-points`, point)
      .pipe(tap((updated) => this.trip.next(updated)));
  }

  updateDropoffPoint(
    tripId: string,
    pointId: string,
    changes: Partial<DropoffPointPayload>,
  ): Observable<TripType> {
    return this.http
      .put<TripType>(
        `${this.baseUrl}/${tripId}/dropoff-points/${pointId}`,
        changes,
      )
      .pipe(tap((updated) => this.trip.next(updated)));
  }
}
