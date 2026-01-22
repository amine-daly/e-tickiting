import { Routes } from '@angular/router';
import { CustomersResolver } from './customers.resolver';
import { CustomersComponent } from './customers.component';

import { CustomersListComponent } from './list/list.component';
import { AccountResolver } from './account/account.resolver';

export const customersRoutes: Routes = [
  {
    path: '',
    component: CustomersComponent,
    children: [
      {
        path: '',
        component: CustomersListComponent,
        resolve: {
          team: CustomersResolver,
        },
      },
      {
        path: ':id',
        resolve: {
          account: AccountResolver,
        },
        loadChildren: () =>
          import('./account/account.routes').then((m) => m.routes),
      },
    ],
  },
];
