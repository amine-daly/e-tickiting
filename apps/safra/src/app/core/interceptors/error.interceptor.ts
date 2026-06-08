import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message =
        (err.error && (err.error.message || err.error.error || err.message)) ||
        'Unexpected error';
      console.error('API error:', message, err);
      return throwError(() => err);
    })
  );
};
