import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthTokenClassInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = this.readToken();
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err) => {
        if (err?.status === 401) {
          this.router.navigateByUrl('/auth/login');
        }
        return throwError(() => err);
      })
    );
  }

  private readToken(): string | undefined {
    // Terminal app stores JSON under v1-auth with { authToken }
    const v1 = localStorage.getItem(
      `${environment.appVersion}-${environment.USERDATA_KEY}`
    );
    if (v1) {
      try {
        const parsed = JSON.parse(v1);
        if (parsed?.authToken) return parsed.authToken;
      } catch {}
    }
    // Fallback to simple 'token' for other app
    const simple = localStorage.getItem('accessToken');
    return simple || undefined;
  }
}
