import { Routes } from '@angular/router';
import { PermissionsResolver } from './permissions.resolver';

export const permissionsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./permissions.component').then((m) => m.PermissionsComponent),
    resolve: { permissions: PermissionsResolver },
  },
];
