import { BehaviorSubject, map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import {
  TripDestinationForm,
  TripSearchParams,
  TripType,
} from '../../../core/models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private baseUrl = `${environment.apiBase}/trips`;
  private trip = new BehaviorSubject<TripType | null>(null);
  private allTrips = new BehaviorSubject<TripType[]>([]);
  private filtredTrips = new BehaviorSubject<TripType[]>([]);
  private selectedDestination = new BehaviorSubject<TripDestinationForm | null>(
    null
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
      })
    );
  }

  getTrips(): Observable<TripType[]> {
    return this.http.get<TripType[]>(`${this.baseUrl}/search`, {}).pipe(
      map((data: TripType[]) => {
        this.allTrips.next(data);
        return data;
      })
    );
  }

  searchTrips(params: TripSearchParams): Observable<TripType[]> {
    let httpParams = new HttpParams();
    if (params.originPlaceId) {
      httpParams = httpParams.set('originPlaceId', params.originPlaceId);
    }
    if (params.destinationPlaceId) {
      httpParams = httpParams.set('destinationPlaceId', params.destinationPlaceId);
    }
    if (params.date) {
      httpParams = httpParams.set('date', params.date);
    }
    if (params.companyId) {
      httpParams = httpParams.set('companyId', params.companyId);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    return this.http
      .get<TripType[]>(`${this.baseUrl}/search`, { params: httpParams })
      .pipe(
        map((data: TripType[]) => {
          this.filtredTrips.next(data);
          return data;
        })
      );
  }
}
