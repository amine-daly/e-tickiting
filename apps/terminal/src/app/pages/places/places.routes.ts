import { Routes } from '@angular/router';
export const placesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./places.component').then((m) => m.PlacesComponent),
  },
];
