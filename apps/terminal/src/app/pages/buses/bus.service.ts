import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, of, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { BusType } from 'src/app/core/models/bus.model';
import { IPagination } from 'src/app/core/models/paginate-model';

interface PaginatedBuses {
  objects: BusType[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class BusService {
  private baseUrl = `${environment.apiBase}/buses`;
  private buses = new BehaviorSubject<BusType[]>([]);
  private bus = new BehaviorSubject<BusType>(null);
  private loading = new BehaviorSubject<boolean>(false);
  private pagination = new BehaviorSubject<IPagination>(null);

  get buses$(): Observable<BusType[]> {
    return this.buses.asObservable();
  }

  get bus$(): Observable<BusType> {
    return this.bus.asObservable();
  }
  set bus$(value: BusType) {
    this.bus.next(value);
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  pageLimit = 12;
  pageIndex = 0;

  constructor(private http: HttpClient) {}

  list(searchString = ''): Observable<BusType[]> {
    this.loading.next(true);
    const params = new HttpParams()
      .set('companyId', localStorage.getItem('companyId') || '')
      .set('searchString', searchString)
      .set('page', this.pageIndex)
      .set('limit', this.pageLimit);
    return this.http.get<PaginatedBuses>(this.baseUrl, { params }).pipe(
      map((data) => {
        const objects = data?.objects ?? [];
        const count = data?.count ?? objects.length;
        this.buses.next(objects);
        this.pagination.next({
          length: count,
          size: this.pageLimit,
          page: this.pageIndex,
          lastPage: Math.max(0, Math.ceil(count / this.pageLimit) - 1),
        });
        return objects;
      }),
      finalize(() => this.loading.next(false)),
    );
  }

  getById(id: string): Observable<BusType> {
    return this.http.get<BusType>(`${this.baseUrl}/${id}`).pipe(
      tap((bus) => {
        this.bus.next(bus);
        return bus;
      }),
    );
  }

  create(payload: Partial<BusType>): Observable<BusType> {
    return this.http.post<BusType>(this.baseUrl, payload).pipe(
      tap((newBus) => {
        const current = this.buses.value ?? [];
        this.buses.next([newBus, ...current]);
        return newBus;
      }),
    );
  }

  update(
    id: string,
    payload: Partial<BusType> & { clearLayout?: boolean },
  ): Observable<BusType> {
    return this.http.put<BusType>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((updatedBus) => {
        const current = this.buses.value ?? [];
        const index = current.findIndex((b) => b.id === id);
        if (index !== -1) {
          current[index] = updatedBus;
          this.buses.next(current);
        }
        return updatedBus;
      }),
    );
  }

  delete(id: string): Observable<void> {
    if (!id) return of(undefined);
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const filtered = (this.buses.value ?? []).filter((b) => b.id !== id);
        this.buses.next(filtered);
      }),
    );
  }

  /** Check if bus totalSeats is locked (assigned to SCHEDULED or ACTIVE trip) */
  isBusLocked(busId: string): Observable<boolean> {
    return this.http
      .get<{ locked: boolean }>(`${this.baseUrl}/${busId}/locked`)
      .pipe(map((res) => res.locked));
  }
}
