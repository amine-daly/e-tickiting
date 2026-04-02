import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CompanyType, CompanyStatus } from 'src/app/core/models/company.model';
import { CurrencyType } from 'src/app/core/models/account.model';
import {
  IPagination,
  PaginateResponse,
} from 'src/app/core/models/paginate-model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private baseUrl = `${environment.apiBase}/companies`;
  private currenciesUrl = `${environment.apiBase}/currencies`;

  private companies = new BehaviorSubject<CompanyType[]>([]);
  private company = new BehaviorSubject<CompanyType>(null);
  private loading = new BehaviorSubject<boolean>(false);
  private pagination = new BehaviorSubject<IPagination>(null);

  get companies$(): Observable<CompanyType[]> {
    return this.companies.asObservable();
  }

  get company$(): Observable<CompanyType> {
    return this.company.asObservable();
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

  list(searchString = '', status?: CompanyStatus): Observable<CompanyType[]> {
    this.loading.next(true);
    let params = new HttpParams()
      .set('searchString', searchString)
      .set('page', this.pageIndex)
      .set('limit', this.pageLimit);
    if (status) {
      params = params.set('status', status);
    }
    return this.http
      .get<PaginateResponse<CompanyType>>(this.baseUrl, { params })
      .pipe(
        map((data) => {
          const objects = data?.objects ?? [];
          const count = data?.count ?? objects.length;
          this.companies.next(objects);
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

  getById(id: string): Observable<CompanyType> {
    return this.http
      .get<CompanyType>(`${this.baseUrl}/${id}`)
      .pipe(tap((company) => this.company.next(company)));
  }

  create(payload: Partial<CompanyType>): Observable<CompanyType> {
    return this.http.post<CompanyType>(this.baseUrl, payload).pipe(
      tap((created) => {
        const current = this.companies.value ?? [];
        this.companies.next([created, ...current]);
      }),
    );
  }

  update(id: string, payload: Partial<CompanyType>): Observable<CompanyType> {
    return this.http.put<CompanyType>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((updated) => {
        const current = this.companies.value ?? [];
        const index = current.findIndex((c) => c.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.companies.next([...current]);
        }
        this.company.next(updated);
      }),
    );
  }

  updateStatus(id: string, status: CompanyStatus): Observable<CompanyType> {
    return this.http
      .patch<CompanyType>(`${this.baseUrl}/${id}/status`, { status })
      .pipe(
        tap((updated) => {
          const current = this.companies.value ?? [];
          const index = current.findIndex((c) => c.id === id);
          if (index >= 0) {
            current[index] = updated;
            this.companies.next([...current]);
          }
        }),
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const current = this.companies.value ?? [];
        this.companies.next(current.filter((c) => c.id !== id));
      }),
    );
  }

  getCurrencies(searchString = ''): Observable<CurrencyType[]> {
    const params = new HttpParams()
      .set('limit', 100)
      .set('searchString', searchString);
    return this.http
      .get<PaginateResponse<CurrencyType>>(this.currenciesUrl, { params })
      .pipe(map((data) => data?.objects ?? []));
  }
}
