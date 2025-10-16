import { Routes } from '@angular/router';
import { ErrorsComponent } from './errors.component';

export const errorsRoutes: Routes = [
  {
    path: '',
    component: ErrorsComponent,
    children: [
      {
        path: '404',
        loadComponent: () => import('./error404/error404.component').then(m => m.Error404Component)
      },
      { path: '', redirectTo: '404', pathMatch: 'full' },
      { path: '**', redirectTo: '404', pathMatch: 'full' }
    ]
  }
];
