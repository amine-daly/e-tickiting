import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { CustomersService } from './customers.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomersResolver implements Resolve<any> {
  constructor(private customersService: CustomersService) {}

  resolve(): Observable<any> {
    return this.customersService.getAll();
  }
}
