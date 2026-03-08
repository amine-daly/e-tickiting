import { Routes } from '@angular/router';
import { BusResolver } from './bus.resolver';

export const busRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/bus-list.component').then((m) => m.BusListComponent),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./details/details.component').then((m) => m.BusDetailsComponent),
  },
  {
    path: ':busId/edit',
    resolve: { bus: BusResolver },
    loadComponent: () =>
      import('./details/details.component').then((m) => m.BusDetailsComponent),
  },
];
