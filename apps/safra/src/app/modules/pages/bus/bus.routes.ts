import { Routes } from '@angular/router';
export const busRoutes: Routes = [
  {
    path: '',
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
