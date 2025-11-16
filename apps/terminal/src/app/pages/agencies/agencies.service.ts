import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AgencyType } from 'src/app/core/models/trip.model';

@Injectable({ providedIn: 'root' })
export class AgenciesService {
  private baseUrl = `${environment.apiBase}/agencies`;

  private agencies = new BehaviorSubject<AgencyType[]>([]);
  private loadingAgencies = new BehaviorSubject<boolean>(false);
  private error = new BehaviorSubject<string | null>(null);

  get agencies$(): Observable<AgencyType[]> {
    return this.agencies.asObservable();
  }

  get loadingAgencies$(): Observable<boolean> {
    return this.loadingAgencies.asObservable();
  }

  get error$(): Observable<string | null> {
    return this.error.asObservable();
  }

  constructor(private http: HttpClient) {}

  getAgencies(): Observable<AgencyType[]> {
    this.loadingAgencies.next(true);
    return this.http
      .get<AgencyType[] | { objects: AgencyType[] }>(this.baseUrl)
      .pipe(
        map((response) =>
          Array.isArray(response)
            ? response
            : Array.isArray(response?.objects)
            ? response.objects
            : []
        ),
        tap((list) => {
          this.error.next(null);
          this.agencies.next(list);
        }),
        catchError((error) => {
          this.error.next('Échec du chargement des agences');
          this.agencies.next([]);
          return throwError(() => error);
        }),
        finalize(() => this.loadingAgencies.next(false))
      );
  }

  create(agency: AgencyType): Observable<AgencyType> {
    return this.http.post<AgencyType>(this.baseUrl, agency).pipe(
      map((created: AgencyType) => {
        this.error.next(null);
        const current = this.agencies.value ?? [];
        this.agencies.next([...current, created]);
        return created;
      })
    );
  }

  update(id: string, changes: Partial<AgencyType>): Observable<AgencyType> {
    return this.http.patch<AgencyType>(`${this.baseUrl}/${id}`, changes).pipe(
      map((updated: AgencyType) => {
        this.error.next(null);
        const updatedList = (this.agencies.value ?? []).map((agency) =>
          agency.id === id ? { ...agency, ...updated } : agency
        );
        this.agencies.next(updatedList);
        return updated;
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      map(() => {
        this.error.next(null);
        const filtered = (this.agencies.value ?? []).filter((p) => p.id !== id);
        this.agencies.next(filtered);
      })
    );
  }
}
