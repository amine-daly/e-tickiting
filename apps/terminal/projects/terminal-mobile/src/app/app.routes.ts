import { Routes } from '@angular/router';
import { guestGuard, authGuard } from 'src/app/modules/auth/guards/auth.guard';
import { Routing as childRoutes } from 'src/app/pages/routing';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('src/app/modules/auth/auth.routes').then((m) => m.authRoutes),
    canActivate: [guestGuard],
  },
  {
    path: 'error',
    loadChildren: () =>
      import('src/app/modules/errors/errors.routes').then((m) => m.errorsRoutes),
  },
  {
    path: '',
    loadComponent: () =>
      import('src/app/_metronic/layout/layout.component').then(
        (c) => c.LayoutComponent,
      ),
    children: [...childRoutes],
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'error/404' },
];
