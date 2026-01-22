import { Routes } from '@angular/router';

export const businessProfileRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./business-profile.component').then(
        (m) => m.BusinessProfileComponent,
      ),
  },
];
