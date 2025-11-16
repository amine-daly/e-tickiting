import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { PlaceType } from '../../modules/auth/models/place-type';

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

  create(place: PlaceType): Observable<PlaceType> {
    return this.http.post<PlaceType>(this.baseUrl, place).pipe(
      map((created: PlaceType) => {
        this.places.next([...this.places.value, created]);
        return created;
      })
    );
  }

  update(id: string, place: PlaceType): Observable<PlaceType> {
    return this.http.put<PlaceType>(`${this.baseUrl}/${id}`, place).pipe(
      map((updated: PlaceType) => {
        const updatedList = this.places.value.map((p) =>
          p.id === id ? updated : p
        );
        this.places.next(updatedList);
        return updated;
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      map(() => {
        this.places.next(this.places.value.filter((p) => p.id !== id));
      })
    );
  }
}
