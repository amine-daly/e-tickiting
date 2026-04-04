import { Routes } from '@angular/router';

export const ticketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ticket-list.component').then((m) => m.TicketListComponent),
  },
  {
    path: 'sell',
    loadComponent: () =>
      import('./sell-ticket/sell-ticket.component').then(
        (m) => m.SellTicketComponent
      ),
  },
];
