import { Routes } from '@angular/router';
export const agenciesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./agencies.component').then((m) => m.AgenciesComponent),
  },
];
