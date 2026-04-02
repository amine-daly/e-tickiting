import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, EMPTY, Observable, take } from 'rxjs';
import { CompanyService } from './company.service';
import { CompanyType } from 'src/app/core/models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyResolver implements Resolve<CompanyType> {
  constructor(
    private router: Router,
    private companyService: CompanyService,
  ) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<CompanyType> {
    return this.companyService.getById(route.paramMap.get('companyId')).pipe(
      take(1),
      catchError((error) => {
        console.error(error);
        this.router.navigateByUrl('/companies');
        return EMPTY;
      }),
    );
  }
}
