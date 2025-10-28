import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthHTTPService } from './auth-http';
import { Router } from '@angular/router';
import { UserType } from '../models/user-type';
import { AuthUtils } from '../utils/auth.utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authenticated: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  private isLoading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false
  );
  currentUser: BehaviorSubject<UserType> = new BehaviorSubject<UserType>(null);

  accessToken: string;

  get currentUser$(): UserType {
    return this.currentUser.value;
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
    private authHttpService: AuthHTTPService,
    private router: Router
  ) {
    this.accessToken = localStorage.getItem('accessToken') || '';
  }

  // public methods
  login(email: string, password: string): Observable<UserType> {
    this.isLoading.next(true);
    return this.authHttpService.login(email, password).pipe(
      map((res) => {
        console.log('🚀 ~ AuthService ~ login ~ res:', res);
        this.accessToken = res.token;
        const result = res.user;
        this.currentUser.next(result);
        this.authenticated.next(true);
        this.isLoading.next(false);
        return result;
      }),
      catchError(() => {
        this.isLoading.next(false);
        return of(undefined);
      })
    );
  }

  logout() {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('accessToken');
    this.currentUser.next(null as unknown as UserType);
    this.authenticated.next(false);
    this.router.navigateByUrl('/auth/login');
  }

  getUserByToken(token: string): Observable<UserType> {
    return this.authHttpService.getUserByToken(token).pipe(
      map((user: UserType) => {
        if (user) {
          this.currentUser.next(user);
          this.authenticated.next(true);
        } else {
          this.logout();
          this.authenticated.next(false);
        }
        return user;
      })
    );
  }

  check(): Observable<any> {
    if (this.authenticated.value === true) {
      return of(true);
    }
    // Check the access token availability
    if (!this.accessToken) {
      return of(false);
    }

    if (AuthUtils.isTokenExpired(this.accessToken)) {
      return of(false);
    }
    // If the access token exists and it didn't expire, sign in using it
    return this.getUserByToken(this.accessToken);
  }
  // need create new user then login
  registration(user: UserType): Observable<any> {
    this.isLoading.next(true);
    return this.authHttpService.createUser(user).pipe(
      map((res) => {
        this.isLoading.next(false);
        this.currentUser.next(res.user);
        this.authenticated.next(true);
        return res;
      }),
      catchError(() => {
        this.isLoading.next(false);
        return of(undefined);
      })
    );
  }
}
