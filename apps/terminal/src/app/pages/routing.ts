import { Routes } from '@angular/router';

const Routing: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'business-profile',
    loadChildren: () =>
      import('./business-profile/business-profile/business-profile.routes').then(
        (m) => m.businessProfileRoutes,
      ),
  },
  {
    path: 'places',
    loadChildren: () =>
      import('./places/places.routes').then((m) => m.placesRoutes),
  },
  {
    path: 'team',
    loadChildren: () => import('./team/team.routes').then((m) => m.teamRoutes),
  },
  {
    path: 'buses',
    loadChildren: () => import('./buses/buses.routes').then((m) => m.busRoutes),
  },
  {
    path: 'trips',
    loadChildren: () =>
      import('./trip/trip-list.routes').then((m) => m.tripRoutes),
  },
  {
    path: 'tickets',
    loadChildren: () =>
      import('./tickets/ticket-list.routes').then((m) => m.ticketsRoutes),
  },
  {
    path: 'customers',
    loadChildren: () =>
      import('./customers/customers.routes').then((m) => m.customersRoutes),
  },

  {
    path: 'customers',
    loadChildren: () =>
      import('./customers/customers.routes').then((m) => m.customersRoutes),
  },
  {
    path: 'permissions',
    loadChildren: () =>
      import('./permissions/permissions.routes').then(
        (m) => m.permissionsRoutes,
      ),
  },
  {
    path: 'crafted/pages/profile',
    loadChildren: () =>
      import('../modules/profile/profile.module').then((m) => m.ProfileModule),
    data: { layout: 'light-sidebar' },
  },
  {
    path: 'crafted/widgets',
    loadChildren: () =>
      import('../modules/widgets-examples/widgets-examples.module').then(
        (m) => m.WidgetsExamplesModule,
      ),
    data: { layout: 'light-header' },
  },
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];

export { Routing };
