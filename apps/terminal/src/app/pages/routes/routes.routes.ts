import { Routes } from '@angular/router';

export const routesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./routes-list.component').then((m) => m.RoutesListComponent),
  },
];
