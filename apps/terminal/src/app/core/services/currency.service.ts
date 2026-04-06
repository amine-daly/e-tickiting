import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';

import { CurrencyType } from '../models/account.model';
import { PaginateResponse } from '../models/paginate-model';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly apiBase = `${environment.apiBase}/currencies`;
  private currenciesRequest$?: Observable<CurrencyType[]>;

  constructor(private http: HttpClient) {}

  listAll(): Observable<CurrencyType[]> {
    if (!this.currenciesRequest$) {
      const params = new HttpParams().set('limit', 200).set('searchString', '');
      this.currenciesRequest$ = this.http
        .get<PaginateResponse<CurrencyType>>(this.apiBase, { params })
        .pipe(
          map((response) => response?.objects ?? []),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }

    return this.currenciesRequest$;
  }

  formatLabel(currency: CurrencyType | null | undefined): string {
    const code = currency?.code?.trim();
    const name = currency?.name?.trim();

    if (code && name) {
      return `${code} - ${name}`;
    }

    return code || name || '-';
  }
}
