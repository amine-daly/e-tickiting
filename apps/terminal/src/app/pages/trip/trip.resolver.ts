import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, EMPTY, Observable, take } from 'rxjs';
import { TripService } from './trip.service';
import { TripType } from 'src/app/core/models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripResolver implements Resolve<TripType> {
  constructor(
    private router: Router,
    private tripService: TripService,
  ) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<TripType> {
    return this.tripService.getById(route.paramMap.get('id')).pipe(
      take(1),
      catchError((error) => {
        console.error(error);
        this.router.navigateByUrl('/trips');
        return EMPTY;
      }),
    );
  }
}
