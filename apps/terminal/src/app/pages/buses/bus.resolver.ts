import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, EMPTY, Observable, take } from 'rxjs';
import { BusService } from './bus.service';
import { BusType } from 'src/app/core/models/bus.model';

@Injectable({ providedIn: 'root' })
export class BusResolver implements Resolve<BusType> {
  constructor(
    private router: Router,
    private busService: BusService,
  ) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<BusType> {
    return this.busService.getBusById(route.paramMap.get('busId')).pipe(
      take(1),
      catchError((error) => {
        console.error(error);
        this.router.navigateByUrl('/buses');
        return EMPTY;
      }),
    );
  }
}
