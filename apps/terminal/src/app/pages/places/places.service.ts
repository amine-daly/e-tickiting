import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { PlaceType } from '../../core/models/place-type';

export interface PlaceCreatePayload {
  city: string;
  location: PlaceType['location'];
}

export interface PlaceUpdatePayload {
  city?: string;
  location?: PlaceType['location'];
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private baseUrl = `${environment.apiBase}/places`;
  private places = new BehaviorSubject<PlaceType[]>([]);

  get places$(): Observable<PlaceType[]> {
    return this.places.asObservable();
  }

  constructor(private http: HttpClient) {}

  getPlaces(): Observable<PlaceType[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map((data: any) => {
        this.places.next(data.objects);
        return data.objects;
      })
    );
  }

  createPlace(payload: PlaceCreatePayload): Observable<PlaceType> {
    return this.http.post<PlaceType>(this.baseUrl, payload).pipe(
      map((created: PlaceType) => {
        this.places.next([...this.places.value, created]);
        return created;
      })
    );
  }

  updatePlace(id: string, changes: PlaceUpdatePayload): Observable<PlaceType> {
    return this.http.put<PlaceType>(`${this.baseUrl}/${id}`, changes).pipe(
      map((updated: PlaceType) => {
        const updatedList = this.places.value.map((p) =>
          p.id === id ? updated : p
        );
        this.places.next(updatedList);
        return updated;
      })
    );
  }

  deletePlace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      map(() => {
        this.places.next(this.places.value.filter((p) => p.id !== id));
      })
    );
  }
}
