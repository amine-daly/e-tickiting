import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PaginateResponse, Trip } from '../models/api';

@Injectable({ providedIn: 'root' })
export class TripService {
  private http = inject(HttpClient);

  create(payload: any) {
    return this.http.post<Trip>('/api/trips', payload);
  }

  get(id: string) {
    return this.http.get<Trip>(`/api/trips/${id}`);
  }

  list(page = 0, limit = 10) {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<PaginateResponse<Trip>>('/api/trips', { params });
  }

  search(
    source: string,
    destination: string,
    date: string,
    page = 0,
    limit = 10
  ) {
    const params = new HttpParams()
      .set('source', source)
      .set('destination', destination)
      .set('date', date)
      .set('page', page)
      .set('limit', limit);
    return this.http.get<PaginateResponse<Trip>>('/api/search/trips', {
      params,
    });
  }
}
