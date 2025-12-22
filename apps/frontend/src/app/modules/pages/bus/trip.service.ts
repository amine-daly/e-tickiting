import { BehaviorSubject, map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import {
  TripDestinationForm,
  TripSearchParams,
  TripType,
} from '../../../core/models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private baseUrl = `${environment.apiBase}/trips`;
  private trip = new BehaviorSubject<TripType>(null);
  private allTrips = new BehaviorSubject<TripType[]>([]);
  private filtredTrips = new BehaviorSubject<TripType[]>([]);
  private selectedDestination = new BehaviorSubject<TripDestinationForm | null>(
    null
  );

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
      map((data: any) => {
        this.trip.next(data);
        console.log(
          '🚀 ~ TripService ~ getTripById ~ this.trip:',
          this.trip.value
        );
        return data;
      })
    );
  }

  getTrips(): Observable<TripType[]> {
    return this.http.get<any>(`${this.baseUrl}/search`, {}).pipe(
      map((data: any) => {
        this.allTrips.next(data.objects);
        return data.objects;
      })
    );
  }

  searchTrips(params: TripSearchParams): Observable<any> {
    return this.http
      .get<any>(`${this.baseUrl}/search`, {
        params: { ...params },
      })
      .pipe(
        map((data: any) => {
          this.filtredTrips.next(data.objects);
          return data.objects;
        })
      );
  }
}
