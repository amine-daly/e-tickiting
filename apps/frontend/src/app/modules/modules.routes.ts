import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SeatSelectComponent } from './pages/select-seat/seat-select.component';
import { VerificationComponent } from './pages/verification/verification.component';
import { MainLayoutComponent } from '../shared/layout/main-layout/main-layout.component';
import { TripResolver } from './pages/bus/trip.resolver';

export const modulesRoutes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'seat-select', component: SeatSelectComponent },
      { path: 'verification', component: VerificationComponent },
      {
        path: 'bus-listing',
        resolve: { trips: TripResolver },
        loadChildren: () =>
          import('./pages/bus/bus.routes').then((m) => m.busRoutes),
      },
    ],
  },
];
