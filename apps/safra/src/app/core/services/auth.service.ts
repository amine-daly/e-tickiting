import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { catchError, take, tap } from 'rxjs/operators';
import { AppsEnum, UserType } from '../models/user-type';
import { AuthResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = signal<string | null>(localStorage.getItem('accessToken'));

  private authenticated = new BehaviorSubject<boolean>(null);
  private currentUser = new BehaviorSubject<UserType>(null);

  get authenticated$(): Observable<boolean> {
    return this.authenticated.asObservable();
  }
  get currentUser$(): Observable<UserType> {
    return this.currentUser.asObservable();
  }

  constructor(private http: HttpClient) {
    const t = this.token();
    if (t) {
      this.me()
        .pipe(
          take(1),
          catchError(() => {
            this.logout();
            return EMPTY;
          })
        )
        .subscribe();
      this.authenticated.next(true);
    } else {
      this.currentUser.next(null);
      this.authenticated.next(false);
    }
  }

  register(payload: any): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', {
        ...payload,
        app: AppsEnum.FRONT,
      })
      .pipe(tap((res) => this.persist(res)));
  }

  login(payload: any): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', {
        ...payload,
        app: AppsEnum.FRONT,
      })
      .pipe(tap((res) => this.persist(res)));
  }

  me(): Observable<UserType> {
    return this.http
      .get<UserType>('/api/users/me')
      .pipe(tap((u) => this.currentUser.next(u)));
  }

  logout() {
    this.currentUser.next(null);
    this.token.set(null);
    this.authenticated.next(false);
    localStorage.removeItem('accessToken');
  }

  private persist(res: AuthResponse) {
    localStorage.setItem('accessToken', res.token);
    this.token.set(res.token);
    this.currentUser.next(res.user);
    this.authenticated.next(true);
  }
}
