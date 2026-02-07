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

  getAccountsByTarget(): Observable<AccountType[]> {
    this.loading.next(true);
    const params = new HttpParams()
      .set('posId', localStorage.getItem('posId'))
      .set('page', this.pageIndex)
      .set('limit', this.pageLimit);
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
    target: { posId: string };
  }): Observable<AccountType> {
    return this.http.post<AccountType>(`${this.baseUrl}`, payload).pipe(
      tap(({ data }: any) => {
        console.log('🚀 ~ TeamService ~ createAccount ~ data:', data);
        if (data) {
          const accounts = [data, ...this.accounts.value];
          this.accounts.next(accounts);
          console.log(
            '🚀 ~ TeamService ~ createAccount ~ this.accounts:',
            this.accounts.value,
          );
        }
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
          if (createdAccount) {
            const accounts = [createdAccount, ...this.accounts.value];
            this.accounts.next(accounts);
          }
        }),
      );
  }
}
