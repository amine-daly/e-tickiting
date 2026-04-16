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
      import('./trip/details.component').then((m) => m.TripDetailsComponent),
  },
  {
    path: ':id',
    resolve: { trip: TripResolver },
    loadComponent: () =>
      import('./trip-info/trip-info.component').then(
        (m) => m.TripInfoComponent,
      ),
  },
  {
    path: ':id/edit',
    resolve: { trip: TripResolver },
    loadComponent: () =>
      import('./trip/details.component').then((m) => m.TripDetailsComponent),
  },
];
