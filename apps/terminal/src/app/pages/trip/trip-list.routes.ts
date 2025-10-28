import { Routes } from '@angular/router';
export const tripRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trip-list.component').then((m) => m.TripListComponent),
  },
];
