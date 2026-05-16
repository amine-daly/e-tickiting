import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SeatSelectComponent } from './pages/select-seat/seat-select.component';
import { VerificationComponent } from './pages/verification/verification.component';
import { MainLayoutComponent } from '../shared/layout/main-layout/main-layout.component';
import {
  seatSelectGuard,
  verificationGuard,
} from '../core/guards/frontoffice-booking.guard';

export const modulesRoutes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      {
        path: 'seat-select',
        component: SeatSelectComponent,
        canActivate: [seatSelectGuard],
      },
      {
        path: 'verification',
        component: VerificationComponent,
        canActivate: [verificationGuard],
      },
      {
        path: 'bus-listing',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./pages/bus/bus.routes').then((m) => m.busRoutes),
      },
    ],
  },
];
