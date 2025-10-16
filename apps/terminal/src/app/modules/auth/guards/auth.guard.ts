import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');
  const hasUser = !!token;
  if (hasUser) return true;
  return router.parseUrl('/auth/login');
};

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');
  const hasUser = !!token;
  if (hasUser) return router.parseUrl('/dashboard');
  return true;
};
