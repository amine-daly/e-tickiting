import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AppsEnum, UserType } from '../../../../core/models/user-type';
import { environment } from '../../../../../environments/environment';
import { AuthResponse } from '../../../../core/models/auth.model';
import { AuthUtils } from '../../utils/auth.utils';

const API_AUTH_URL = `${environment.apiBase}/auth`;
const API_USERS_URL = `${environment.apiBase}/users`;

@Injectable({
  providedIn: 'root',
})
export class AuthHTTPService {
  constructor(private http: HttpClient) {}

  // public methods
  login(
    email: string | undefined,
    password: string,
    phone?: { countryCode: string; number: string }
  ): Observable<AuthResponse> {
    const payload: any = { password };
    if (email) payload.email = email;
    if (!email && phone) payload.phone = phone;
    return this.http
      .post<{ token: string; user: any }>(`${API_AUTH_URL}/login`, {
        ...payload,
        app: AppsEnum.TERMINAL,
      })
      .pipe(
        map((res) => {
          localStorage.setItem('accessToken', res.token);
          return res;
        })
      );
  }

  // Registration hitting backend /api/auth/register
  createUser(input: any): Observable<AuthResponse> {
    return this.http
      .post<{ token: string; user: any }>(`${API_AUTH_URL}/register`, {
        ...input,
        app: AppsEnum.TERMINAL,
      })
      .pipe(
        map((res) => {
          const auth = new AuthResponse();
          auth.user = res.user;
          localStorage.setItem('accessToken', res.token);
          return auth;
        })
      );
  }

  // Your server should check email => If email exists send link to the user and return true | If email doesn't exist return false
  forgotPassword(email: string): Observable<boolean> {
    // Not yet implemented on backend; return observable false for now or adapt when endpoint exists
    return this.http.post<boolean>(`${API_AUTH_URL}/forgot-password`, {
      email,
    });
  }

  getUserByToken(token: string): Observable<UserType> {
    const httpHeaders = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<UserType>(`${API_USERS_URL}/me`, {
      headers: httpHeaders,
    });
  }
}
