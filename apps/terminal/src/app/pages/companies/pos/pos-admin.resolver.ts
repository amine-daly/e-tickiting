import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { PointOfSaleType } from 'src/app/core/models/account.model';
import { PosAdminService } from './pos-admin.service';

@Injectable({ providedIn: 'root' })
export class PosAdminResolver implements Resolve<PointOfSaleType> {
  constructor(
    private posService: PosAdminService,
    private router: Router,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<PointOfSaleType> {
    const posId = route.paramMap.get('posId');
    return this.posService.getById(posId).pipe(
      catchError(() => {
        const companyId = route.parent?.paramMap.get('companyId') || '';
        this.router.navigate(['/companies', companyId, 'pos']);
        return of(null);
      }),
    );
  }
}
