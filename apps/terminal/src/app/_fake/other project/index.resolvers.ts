import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { IndexService } from './index.service';
import { CorporateUserDashType } from '@sifca-monorepo/terminal-generator';

@Injectable({
  providedIn: 'root',
})
export class DashboardResolver implements Resolve<any> {
  constructor(private indexService: IndexService) {}

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<CorporateUserDashType[]> {
    return this.indexService.getCorporateDashboardByTargetAndUser();
  }
}
