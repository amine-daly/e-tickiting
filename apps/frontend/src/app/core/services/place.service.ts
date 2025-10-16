import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ZoneTypesEnum = 'POINT' | 'POLYGON';
export interface LonLatType {
  type: ZoneTypesEnum;
  coordinates: number[];
}
export interface Place {
  id: string;
  city: string;
  location: LonLatType;
}
export interface Paginated<T> {
  objects: T[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlaceService {
  private http = inject(HttpClient);

  list(q = '', page = 0, limit = 100): Observable<Paginated<Place>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (q) params = params.set('q', q);
    return this.http.get<Paginated<Place>>('/api/places', { params });
  }

  get(id: string) {
    return this.http.get<Place>(`/api/places/${id}`);
  }
  create(body: { city: string; location: LonLatType }) {
    return this.http.post<Place>('/api/places', body);
  }
  update(id: string, body: { city: string; location: LonLatType }) {
    return this.http.put<Place>(`/api/places/${id}`, body);
  }
  delete(id: string) {
    return this.http.delete<void>(`/api/places/${id}`);
  }
}
