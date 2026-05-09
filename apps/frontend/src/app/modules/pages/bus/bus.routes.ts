import { Routes } from '@angular/router';
import { TripResolver } from './trip.resolver';

export const busRoutes: Routes = [
  {
    path: '',
    resolve: { trips: TripResolver },
    loadComponent: () =>
      import('./list/list.component').then((m) => m.BusListComponent),
  },
  {
    path: 'details/:id',
    loadComponent: () =>
      import('./details/details.component').then((m) => m.BusDetailsComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '',
  },
];
