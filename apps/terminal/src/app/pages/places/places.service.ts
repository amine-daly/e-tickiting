import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { map, Observable } from 'rxjs';
import { PlaceType } from '../../modules/auth/models/place-type';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private baseUrl = `${environment.apiBase}/places`;
  places = signal<PlaceType[]>([]);

  constructor(private http: HttpClient) {}

  getAll(): Observable<PlaceType[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map((data: any) => {
        this.places.set(data.objects);
        return data.objects;
      })
    );
  }

  create(place: PlaceType): Observable<PlaceType> {
    return this.http.post<PlaceType>(this.baseUrl, place).pipe(
      map((created: PlaceType) => {
        this.places.set([...this.places(), created]);
        return created;
      })
    );
  }

  update(id: string, place: PlaceType): Observable<PlaceType> {
    return this.http.put<PlaceType>(`${this.baseUrl}/${id}`, place).pipe(
      map((updated: PlaceType) => {
        const updatedList = this.places().map((p) =>
          p.id === id ? updated : p
        );
        this.places.set(updatedList);
        return updated;
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      map(() => {
        this.places.set(this.places().filter((p) => p.id !== id));
      })
    );
  }
}
