import { Routes } from '@angular/router';
import { TripResolver } from './trip.resolver';

export const tripRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trip-list.component').then((m) => m.TripListComponent),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./trip-create/trip-create.component').then(
        (m) => m.TripCreateComponent,
      ),
  },
  {
    path: ':id',
    resolve: { trip: TripResolver },
    loadComponent: () =>
      import('./trip-detail/trip-detail.component').then(
        (m) => m.TripDetailComponent,
      ),
  },
];
