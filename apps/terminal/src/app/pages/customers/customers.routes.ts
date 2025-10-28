import { Routes } from '@angular/router';
import { CustomersResolver } from './customers.resolver';

export const customersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customers.component').then((m) => m.CustomersComponent),
    resolve: { customers: CustomersResolver },
  },
];
