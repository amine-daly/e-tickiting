import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable } from 'rxjs';
import { PermissionsService } from './permissions.service';

@Injectable({ providedIn: 'root' })
export class PermissionsResolver implements Resolve<any> {
  constructor(private permissionsService: PermissionsService) {}

  resolve(): Observable<any> {
    return this.permissionsService.loadInitialData();
  }
}
