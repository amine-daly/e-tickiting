import { Routes } from '@angular/router';
import { PosAdminResolver } from './pos-admin.resolver';

export const posAdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/pos-list.component').then((m) => m.PosListComponent),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./details/pos-details.component').then(
        (m) => m.PosDetailsComponent,
      ),
  },
  {
    path: ':posId/edit',
    loadComponent: () =>
      import('./details/pos-details.component').then(
        (m) => m.PosDetailsComponent,
      ),
    resolve: { pos: PosAdminResolver },
  },
];
