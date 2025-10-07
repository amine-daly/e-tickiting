import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthResponse, User } from '../models/api';
import { EMPTY, Observable } from 'rxjs';
import { catchError, take, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  user = signal<User | null>(null);
  token = signal<string | null>(localStorage.getItem('token'));

  constructor() {
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
    }
  }

  register(payload: any): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', payload)
      .pipe(tap((res) => this.persist(res)));
  }

  login(payload: any): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', payload)
      .pipe(tap((res) => this.persist(res)));
  }

  me(): Observable<User> {
    return this.http
      .get<User>('/api/users/me')
      .pipe(tap((u) => this.user.set(u)));
  }

  logout() {
    this.user.set(null);
    this.token.set(null);
    localStorage.removeItem('token');
  }

  private persist(res: AuthResponse) {
    localStorage.setItem('token', res.token);
    this.token.set(res.token);
    this.user.set(res.user);
  }
}
