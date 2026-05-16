import { BehaviorSubject, map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { PaginateResponse } from '../../../core/models/paginate-response.model';
import {
  TripDestinationForm,
  TripRouteSelection,
  TripSearchParams,
  TripStatusEnum,
  TripRouteAvailabilityType,
  TripType,
  TripWithMarketplace,
} from '../../../core/models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private baseUrl = `${environment.apiBase}/trips`;
  private defaultSearchLimit = 100;
  private trip = new BehaviorSubject<TripType>(null);
  private allTrips = new BehaviorSubject<TripType[]>([]);
  private filtredTrips = new BehaviorSubject<TripType[]>([]);
  private selectedDestination = new BehaviorSubject<TripDestinationForm | null>(
    null,
  );

  get trip$(): Observable<TripType | null> {
    return this.trip.asObservable();
  }

  get selectedDestination$(): Observable<TripDestinationForm | null> {
    return this.selectedDestination.asObservable();
  }
  set selectedDestination$(value: TripDestinationForm | null) {
    this.selectedDestination.next(value);
  }

  get filtredTrips$(): Observable<TripType[]> {
    return this.filtredTrips.asObservable();
  }

  get allTrips$(): Observable<TripType[]> {
    return this.allTrips.asObservable();
  }

  constructor(private http: HttpClient) {}

  getTripById(
    id: string,
    routeSelection?: TripRouteSelection,
  ): Observable<TripType> {
    let params = new HttpParams();

    if (routeSelection?.originPlaceId) {
      params = params.set('originPlaceId', routeSelection.originPlaceId);
    }
    if (routeSelection?.destinationPlaceId) {
      params = params.set(
        'destinationPlaceId',
        routeSelection.destinationPlaceId,
      );
    }
    if (routeSelection?.date) {
      params = params.set('date', routeSelection.date);
    }

    return this.http.get<TripType>(`${this.baseUrl}/${id}`, { params }).pipe(
      map((data: TripType) => {
        this.trip.next(data);
        return data;
      }),
    );
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

  getTrips(): Observable<TripType[]> {
    return this.http
      .get<PaginateResponse<TripType> | TripType[]>(`${this.baseUrl}/search`, {
        params: this.buildHttpParams(
          { status: TripStatusEnum.ACTIVE },
          this.defaultSearchLimit,
        ),
      })
      .pipe(
        map((response: any) => {
          const trips = response.objects || [];
          this.allTrips.next(trips);
          return trips;
        }),
      );
  }

  searchTrips(params: TripSearchParams): Observable<TripType[]> {
    return this.http
      .get<PaginateResponse<TripType> | TripType[]>(`${this.baseUrl}/search`, {
        params: this.buildHttpParams(params, this.defaultSearchLimit),
      })
      .pipe(
        map((response: any) => {
          const trips = response.objects.filter(
            (trip): trip is TripWithMarketplace => !!trip.marketplace,
          );
          this.filtredTrips.next(trips);
          return trips;
        }),
      );
  }

  private buildHttpParams(params: TripSearchParams, limit: number): HttpParams {
    let httpParams = new HttpParams().set('limit', String(limit));
    const companyId = params.companyId || this.getStoredCompanyId();

    if (params.originPlaceId) {
      httpParams = httpParams.set('originPlaceId', params.originPlaceId);
    }
    if (params.destinationPlaceId) {
      httpParams = httpParams.set(
        'destinationPlaceId',
        params.destinationPlaceId,
      );
    }
    if (params.date) {
      httpParams = httpParams.set('date', params.date);
    }
    if (companyId) {
      httpParams = httpParams.set('companyId', companyId);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }

    return httpParams;
  }

  private getStoredCompanyId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem('companyId');
  }
}
