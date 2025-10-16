import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

export const authTokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const tokenFromV1 = localStorage.getItem(
    `${environment.appVersion}-${environment.USERDATA_KEY}`
  );
  const tokenFromSimple = localStorage.getItem('accessToken');
  const token = (() => {
    try {
      if (tokenFromV1) {
        const parsed = JSON.parse(tokenFromV1);
        if (parsed?.authToken) return parsed.authToken;
      }
    } catch {}
    return tokenFromSimple || undefined;
  })();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 401) {
        router.navigateByUrl('/auth/login');
      }
      return throwError(() => err);
    })
  );
};
