import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PointOfSaleType } from 'src/app/core/models/account.model';
import { IPagination } from 'src/app/core/models/paginate-model';

interface PaginatedPos {
  objects: PointOfSaleType[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class PosAdminService {
  private baseUrl = `${environment.apiBase}/pos`;
  private posList = new BehaviorSubject<PointOfSaleType[]>([]);
  private pos = new BehaviorSubject<PointOfSaleType>(null);
  private loading = new BehaviorSubject<boolean>(false);
  private pagination = new BehaviorSubject<IPagination>(null);

  get posList$(): Observable<PointOfSaleType[]> {
    return this.posList.asObservable();
  }

  get pos$(): Observable<PointOfSaleType> {
    return this.pos.asObservable();
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

  list(companyId: string, searchString = ''): Observable<PointOfSaleType[]> {
    this.loading.next(true);
    let params = new HttpParams()
      .set('companyId', companyId)
      .set('searchString', searchString)
      .set('page', this.pageIndex)
      .set('limit', this.pageLimit);
    return this.http.get<PaginatedPos>(this.baseUrl, { params }).pipe(
      map((data) => {
        const objects = data?.objects ?? [];
        const count = data?.count ?? objects.length;
        this.posList.next(objects);
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

  getById(id: string): Observable<PointOfSaleType> {
    return this.http
      .get<PointOfSaleType>(`${this.baseUrl}/${id}`)
      .pipe(tap((pos) => this.pos.next(pos)));
  }

  create(payload: Partial<PointOfSaleType>): Observable<PointOfSaleType> {
    return this.http.post<PointOfSaleType>(this.baseUrl, payload).pipe(
      tap((newPos) => {
        const current = this.posList.value ?? [];
        this.posList.next([newPos, ...current]);
      }),
    );
  }

  update(
    id: string,
    payload: Partial<PointOfSaleType>,
  ): Observable<PointOfSaleType> {
    return this.http
      .put<PointOfSaleType>(`${this.baseUrl}/${id}`, payload)
      .pipe(
        tap((updated) => {
          this.pos.next(updated);
          const current = this.posList.value ?? [];
          const idx = current.findIndex((p) => p.id === id);
          if (idx > -1) {
            current[idx] = updated;
            this.posList.next([...current]);
          }
        }),
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const current = this.posList.value ?? [];
        this.posList.next(current.filter((p) => p.id !== id));
      }),
    );
  }
}
