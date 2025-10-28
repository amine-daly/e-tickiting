import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';
import { map, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  /**
   * Can activate route
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    const redirectUrl = state.url === '/sign-out' ? '/' : state.url;
    return this.check();
  }

  private check(): Observable<any> {
    return this.authService.check().pipe(
      map((user) => {
        if (!isPlatformBrowser(this.platformId)) {
          return true;
        }

        if (!user) {
          return this.authService.logout();
        }
        return true;
      })
    );
  }
}
