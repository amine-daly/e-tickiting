import { Routes } from '@angular/router';

export const ticketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ticket-list.component').then((m) => m.TicketListComponent),
  },
];
