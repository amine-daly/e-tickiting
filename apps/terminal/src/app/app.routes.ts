import { Routes } from '@angular/router';
import { guestGuard } from './modules/auth/guards/auth.guard';
import { Routing as childRoutes } from './pages/routing';
import { AuthGuard } from './modules/auth/services/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
    canActivate: [guestGuard],
  },
  {
    path: 'error',
    loadChildren: () =>
      import('./modules/errors/errors.routes').then((m) => m.errorsRoutes),
  },
  {
    path: '',
    loadComponent: () =>
      import('./_metronic/layout/layout.component').then(
        (c) => c.LayoutComponent
      ),
    children: [...childRoutes],
    canActivate: [AuthGuard],
  },
  { path: '**', redirectTo: 'error/404' },
];
