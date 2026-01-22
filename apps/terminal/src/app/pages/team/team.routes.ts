import { Routes } from '@angular/router';
export const teamRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./team.component').then((m) => m.TeamComponent),
  },
];
