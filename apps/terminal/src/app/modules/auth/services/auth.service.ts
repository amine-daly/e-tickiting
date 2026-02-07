import { find } from 'lodash';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  switchMap,
} from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  AccountType,
  PointOfSaleType,
} from 'src/app/core/models/account.model';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { AppsEnum, UserType } from 'src/app/core/models/user-type';
import { AuthResponse } from 'src/app/core/models/auth.model';
import { AuthUtils } from '../utils/auth.utils';

const API_AUTH_URL = `${environment.apiBase}/auth`;
const API_USERS_URL = `${environment.apiBase}/users`;
const API_CURRENT_ACCOUNT_URL = `${environment.apiBase}/accounts`;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authenticated: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  private pos: BehaviorSubject<PointOfSaleType> =
    new BehaviorSubject<PointOfSaleType>(null);
  private accounts: BehaviorSubject<AccountType[]> = new BehaviorSubject<
    AccountType[]
  >([]);

  private isLoading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );

  accessToken: string;
  currentUser: BehaviorSubject<UserType> = new BehaviorSubject<UserType>(null);

  get currentUser$(): Observable<UserType> {
    return this.currentUser.asObservable();
  }

  get pos$(): Observable<PointOfSaleType> {
    return this.pos.asObservable();
  }
  set pos$(value: any) {
    this.pos.next(value);
  }

  get accounts$(): Observable<AccountType[]> {
    return this.accounts.asObservable();
  }

  get isLoading$(): Observable<boolean> {
    return this.isLoading.asObservable();
  }

  get authenticated$(): Observable<boolean> {
    return this.authenticated.asObservable();
  }
  set authenticated$(value: any) {
    this.authenticated.next(value);
  }

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.accessToken = localStorage.getItem('accessToken') || '';
  }
  // public methods
  login(
    email: string | undefined,
    password: string,
    phone?: { countryCode: string; number: string },
  ): Observable<AccountType[]> {
    this.isLoading.next(true);
    const payload: any = { password };
    if (email) payload.email = email;
    if (!email && phone) payload.phone = phone;
    return this.http
      .post<{ token: string; user: any }>(`${API_AUTH_URL}/login`, {
        ...payload,
        app: AppsEnum.TERMINAL,
      })
      .pipe(
        switchMap((res) => {
          this.authenticated.next(true);
          this.isLoading.next(false);
          localStorage.setItem('userId', res?.user?.id);
          localStorage.setItem('accessToken', res.token);
          return this.getCurrentAccount();
        }),
        catchError(() => {
          this.isLoading.next(false);
          return of(undefined);
        }),
        map((accounts) => {
          this.accounts.next(accounts);
          const pos = accounts[0].target?.pos;
          this.pos.next(pos);
          localStorage.setItem('posId', pos.id);
          return accounts;
        }),
      );
  }

  logout() {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('accessToken');
    this.currentUser.next(null as unknown as UserType);
    this.authenticated.next(false);
    this.router.navigateByUrl('/auth/login');
  }

  getUserByToken(token: string): Observable<AccountType[]> {
    const httpHeaders = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http
      .get<AccountType[]>(`${API_USERS_URL}/me`, {
        headers: httpHeaders,
      })
      .pipe(
        switchMap((user) => {
          if (user) {
            this.authenticated.next(true);
          } else {
            this.logout();
            this.authenticated.next(false);
          }
          return this.getCurrentAccount(true);
        }),
      );
  }

  getCurrentAccount(assignhAccount = false): Observable<AccountType[]> {
    return this.http
      .get<AccountType[]>(`${API_CURRENT_ACCOUNT_URL}/current`)
      .pipe(
        map((accounts) => {
          if (assignhAccount) {
            this.accounts.next(accounts);
            const user = accounts[0].user;
            this.currentUser.next(user);
            const posId = localStorage.getItem('posId');
            const account = find(
              accounts,
              (account: AccountType) => account?.target?.pos?.id === posId,
            );
            this.pos.next(account?.target?.pos);
          }
          this.accounts.next(accounts);
          return accounts;
        }),
      );
  }

  check(): Observable<any> {
    if (this.authenticated.value === true) {
      return of(true);
    }
    if (!this.accessToken) {
      return of(false);
    }

    if (AuthUtils.isTokenExpired(this.accessToken)) {
      return of(false);
    }
    // If the access token exists and it didn't expire, sign in using it
    return this.getUserByToken(this.accessToken);
  }

  // Your server should check email => If email exists send link to the user and return true | If email doesn't exist return false
  forgotPassword(email: string): Observable<boolean> {
    // Not yet implemented on backend; return observable false for now or adapt when endpoint exists
    return this.http.post<boolean>(`${API_AUTH_URL}/forgot-password`, {
      email,
    });
  }
}
