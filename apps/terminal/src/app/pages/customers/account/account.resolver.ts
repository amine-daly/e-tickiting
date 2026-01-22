import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, EMPTY, Observable, take, of } from 'rxjs';
import { CustomersService } from '../customers.service';

@Injectable({ providedIn: 'root' })
export class AccountResolver implements Resolve<any> {
  constructor(
    private router: Router,
    private customersService: CustomersService,
  ) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<any> {
    return this.customersService.getUserById(route.paramMap.get('id')).pipe(
      take(1),
      catchError((error) => {
        console.error(error);
        const parentUrl = state.url.split('/').slice(0, -1).join('/');
        this.router.navigateByUrl(parentUrl);
        // Return EMPTY so router won't retry the resolver and won't spam requests
        return EMPTY;
      }),
    );
  }
}
