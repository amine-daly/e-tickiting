import { Routes } from '@angular/router';
import { CompanyResolver } from './company.resolver';

export const companyRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/company-list.component').then(
        (m) => m.CompanyListComponent,
      ),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./details/company-details.component').then(
        (m) => m.CompanyDetailsComponent,
      ),
  },
  {
    path: ':companyId/edit',
    resolve: { company: CompanyResolver },
    loadComponent: () =>
      import('./details/company-details.component').then(
        (m) => m.CompanyDetailsComponent,
      ),
  },
  {
    path: ':companyId/pos',
    loadChildren: () =>
      import('./pos/pos-admin.routes').then((m) => m.posAdminRoutes),
  },
];
