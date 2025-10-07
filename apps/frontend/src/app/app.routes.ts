import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/auth/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./pages/search/results.component').then(
        (m) => m.ResultsComponent
      ),
  },
  {
    path: 'trip/:id',
    loadComponent: () =>
      import('./pages/trip/trip-seats.component').then(
        (m) => m.TripSeatsComponent
      ),
  },
];
