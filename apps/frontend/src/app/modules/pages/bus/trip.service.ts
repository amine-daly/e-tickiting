import { BehaviorSubject, map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { PaginateResponse } from '../../../core/models/paginate-response.model';
import {
  TripDestinationForm,
  TripSearchParams,
  TripStatusEnum,
  TripType,
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

  getTripById(id: string): Observable<TripType> {
    return this.http.get<TripType>(`${this.baseUrl}/${id}`).pipe(
      map((data: TripType) => {
        this.trip.next(data);
        return data;
      }),
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
        map((response) => {
          const trips = this.extractTrips(response);
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
        map((response) => {
          const trips = this.extractTrips(response);
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

  private extractTrips(
    response: PaginateResponse<TripType> | TripType[],
  ): TripType[] {
    return Array.isArray(response) ? response : response?.objects || [];
  }

  private getStoredCompanyId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem('companyId');
  }
}
