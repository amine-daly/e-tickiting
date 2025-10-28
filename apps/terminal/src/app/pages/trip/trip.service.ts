import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { PaginateResponse } from '../../core/models/paginate-response.model';
import { TripFilterInput } from 'src/app/modules/auth/models/trip-filter-input.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private loading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    true
  );
  private trips: BehaviorSubject<PaginateResponse<Trip[]>> =
    new BehaviorSubject<PaginateResponse<Trip[]>>(null);
  private baseUrl = '/api/trips';

  get trips$(): Observable<PaginateResponse<Trip[]>> {
    return this.trips.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  constructor(private http: HttpClient) {}

  getTrips(filter: TripFilterInput): Observable<PaginateResponse<Trip>> {
    this.loading.next(true);
    return this.http
      .get<PaginateResponse<Trip>>(`${this.baseUrl}/search`, {
        params: {
          ...filter,
          page: 0,
          limit: 200,
        },
      })
      .pipe(
        map((data: any) => {
          this.loading.next(false);
          console.log('🚀 ~ TripService ~ getTrips ~ data:', data);
          this.trips.next(data.objects);
          return data;
        })
      );
  }

  createTrip(trip: Partial<Trip>): Observable<Trip> {
    return this.http.post<Trip>(this.baseUrl, trip);
  }

  updateTrip(trip: Partial<Trip>): Observable<Trip> {
    return this.http.put<Trip>(`${this.baseUrl}/${trip.id}`, trip);
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
