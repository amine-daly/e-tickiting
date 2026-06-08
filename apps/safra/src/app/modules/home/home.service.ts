import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { PlaceType } from '../../core/models/place-type';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private baseUrl = `${environment.apiBase}/places`;
  private places = new BehaviorSubject<PlaceType[]>([]);

  get places$(): Observable<PlaceType[]> {
    return this.places.asObservable();
  }

  constructor(private http: HttpClient) {}

  getPlaceById(id: string): Observable<PlaceType> {
    return this.http.get<PlaceType>(`${this.baseUrl}/${id}`);
  }

  fetchPlaces(): Observable<PlaceType[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map((data: any) => {
        this.places.next(data.objects);
        return data.objects;
      }),
    );
  }
}
