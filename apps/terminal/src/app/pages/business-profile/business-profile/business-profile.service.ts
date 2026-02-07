import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CurrencyType,
  LonLatType,
  PointOfSaleType,
} from 'src/app/core/models/account.model';
import { CountryType } from 'src/app/core/models/country-type';
import { StateType } from 'src/app/core/models/state-type';
import { PaginateResponse } from 'src/app/core/models/paginate-model';
import { PhoneType } from 'src/app/core/models/user-type';
import { AuthService } from 'src/app/modules/auth';

export interface LocationPayload {
  addressLine?: string;
  city?: string;
  stateId?: string;
  countryId?: string;
  zipCode?: string;
  location?: LonLatType;
}

export interface PosOverviewPayload {
  title?: string;
  subtitle?: string;
  email?: string;
  phone?: PhoneType;
  currencyId?: string;
  picture?: {
    baseUrl?: string;
    path?: string;
  };
  emailTemplate?: string;
}

export interface PosLocationPayload {
  location?: LocationPayload;
}

export interface PosUpdatePayload
  extends PosOverviewPayload, PosLocationPayload {}

@Injectable({ providedIn: 'root' })
export class BusinessProfileService {
  private apiBase = environment.apiBase;
  private posUrl = `${this.apiBase}/pos`;
  private currenciesUrl = `${this.apiBase}/currencies`;
  private currencies = new BehaviorSubject<CurrencyType[]>([]);

  currenciesSearchString = '';

  get currencies$(): Observable<CurrencyType[]> {
    return this.currencies.asObservable();
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  // ========== POS Operations ==========
  getPosById(id: string): Observable<PointOfSaleType> {
    return this.http.get<PointOfSaleType>(`${this.posUrl}/${id}`);
  }

  updatePos(
    id: string,
    payload: PosUpdatePayload,
  ): Observable<PointOfSaleType> {
    return this.http.put<PointOfSaleType>(`${this.posUrl}/${id}`, payload).pipe(
      map((data) => {
        this.authService.pos$ = data;
        return data;
      }),
    );
  }

  createPos(payload: PosUpdatePayload): Observable<PointOfSaleType> {
    return this.http.post<PointOfSaleType>(this.posUrl, payload);
  }

  deletePos(id: string): Observable<void> {
    return this.http.delete<void>(`${this.posUrl}/${id}`);
  }

  searchPos(searchString?: string, limit = 50): Observable<PointOfSaleType[]> {
    const params: any = { limit };
    if (searchString) {
      params.searchString = searchString;
    }
    return this.http
      .get<PaginateResponse<PointOfSaleType>>(this.posUrl, { params })
      .pipe(map((data) => data.objects || []));
  }

  // ========== Currencies ==========
  getCurrencies(): Observable<CurrencyType[]> {
    const params: any = {
      limit: 100,
      ...(this.currenciesSearchString
        ? { searchString: this.currenciesSearchString }
        : {}),
    };
    return this.http
      .get<PaginateResponse<CurrencyType>>(this.currenciesUrl, { params })
      .pipe(
        map((data) => {
          this.currencies.next(data.objects);
          return data.objects;
        }),
      );
  }
}
