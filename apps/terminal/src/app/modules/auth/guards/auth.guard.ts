import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Functional guard for protected routes.
 * Delegates to AuthService.check() which validates:
 *  1. Whether the user is already authenticated (BehaviorSubject)
 *  2. Whether the access token exists in localStorage
 *  3. Whether the token has expired (via AuthUtils.isTokenExpired)
 *  4. On cold load with a valid token: re-fetches user from server
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.check().pipe(
    map((result) => {
      if (!result) return router.parseUrl('/auth/login');
      return true;
    }),
  );
};

/**
 * Functional guard for guest-only routes (login, forgot-password).
 * Redirects authenticated users straight to the dashboard.
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');
  if (token) return router.parseUrl('/dashboard');
  return true;
};
