import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AccountType } from 'src/app/core/models/account.model';
import { IPagination } from 'src/app/core/models/paginate-model';

interface PaginatedAccounts {
  objects: AccountType[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private baseUrl = `${environment.apiBase}/accounts`;
  private accounts = new BehaviorSubject<AccountType[]>([]);
  private loading = new BehaviorSubject<boolean>(false);
  private pagination = new BehaviorSubject<IPagination>(null);

  get accounts$(): Observable<AccountType[]> {
    return this.accounts.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  getAccountsByTarget(
    posId: string,
    page = 0,
    limit = 9,
  ): Observable<AccountType[]> {
    if (!posId) {
      this.accounts.next([]);
      this.pagination.next({ length: 0, size: limit, page, lastPage: 0 });
      return of([]);
    }
    this.loading.next(true);
    const params = new HttpParams()
      .set('posId', posId)
      .set('page', page)
      .set('limit', limit);
    return this.http
      .get<PaginatedAccounts>(`${this.baseUrl}/by-target`, { params })
      .pipe(
        map((data) => {
          const objects = data?.objects ?? [];
          const count = data?.count ?? objects.length;
          this.accounts.next(objects);
          this.pagination.next({
            length: count,
            size: limit,
            page,
            lastPage: Math.max(0, Math.ceil(count / limit) - 1),
          });
          return objects;
        }),
        finalize(() => this.loading.next(false)),
      );
  }
}
