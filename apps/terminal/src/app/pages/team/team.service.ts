import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, of, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AccountType,
  RegisterAccountForTargetPayload,
} from 'src/app/core/models/account.model';
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

  pageLimit = 10;
  pageIndex = 0;

  constructor(private http: HttpClient) {}

  private prependAccount(account: AccountType): void {
    if (!account) {
      return;
    }

    const currentAccounts = this.accounts.value || [];
    if (account.id && currentAccounts.some((item) => item.id === account.id)) {
      return;
    }

    this.accounts.next([account, ...currentAccounts]);
  }

  getAccountsByTarget(): Observable<AccountType[]> {
    this.loading.next(true);
    const params = new HttpParams()
      .set('companyId', localStorage.getItem('companyId') || '')
      .set('page', this.pageIndex.toString())
      .set('limit', this.pageLimit.toString());
    return this.http
      .get<PaginatedAccounts>(`${this.baseUrl}/by-target`, { params })
      .pipe(
        map((data) => {
          const objects = data?.objects ?? [];
          const count = data?.count ?? objects.length;
          this.accounts.next(objects);
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

  deleteAccount(id: string): Observable<void> {
    if (!id) return of(undefined);
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const filtered = (this.accounts.value ?? []).filter(
          (account) => account.id !== id,
        );
        this.accounts.next(filtered);
      }),
    );
  }

  createAccount(payload: {
    userId: string;
    permissionId?: string;
    target: { companyId: string };
  }): Observable<AccountType> {
    return this.http.post<AccountType>(`${this.baseUrl}`, payload).pipe(
      tap((createdAccount) => {
        this.prependAccount(createdAccount);
      }),
    );
  }

  /**
   * Register a new user and create account for target POS in one API call
   */
  registerAccountForTarget(
    payload: RegisterAccountForTargetPayload,
  ): Observable<AccountType> {
    return this.http
      .post<AccountType>(`${this.baseUrl}/register-for-target`, payload)
      .pipe(
        tap((createdAccount) => {
          this.prependAccount(createdAccount);
        }),
      );
  }
}
