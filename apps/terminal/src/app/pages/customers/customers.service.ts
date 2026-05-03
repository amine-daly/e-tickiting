import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, of } from 'rxjs';

import { environment } from 'src/environments/environment';
import { IPagination } from 'src/app/core/models/paginate-model';
import { PhoneType, RoleEnum, UserType } from 'src/app/core/models/user-type';

const API_USERS_URL = `${environment.apiBase}/users`;

export interface CustomerCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: PhoneType;
}

type CustomerCreateRequest = CustomerCreatePayload & {
  target?: {
    company: string;
  };
};

export interface CustomerUpdatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  phone?: PhoneType;
  picture?: { baseUrl: string; path: string };
}

export interface CustomerListResponse {
  objects: UserType[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private users: BehaviorSubject<UserType[]> = new BehaviorSubject<UserType[]>(
    [],
  );
  private user: BehaviorSubject<UserType> = new BehaviorSubject<UserType>(null);
  private loading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  private pagination: BehaviorSubject<IPagination> =
    new BehaviorSubject<IPagination>(null);

  pageLimit = 10;
  pageIndex = 0;

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get users$(): Observable<UserType[]> {
    return this.users.asObservable();
  }
  set users$(value: UserType[]) {
    this.users.next(value);
  }

  get user$(): Observable<UserType> {
    return this.user.asObservable();
  }
  set user$(value: UserType) {
    this.user.next(value);
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  private getCurrentCompanyId(): string | undefined {
    return localStorage.getItem('companyId') || undefined;
  }

  private syncCustomerPage(
    response: CustomerListResponse,
    page: number,
    size: number,
  ): UserType[] {
    const objects = response?.objects ?? [];
    const count = response?.count ?? objects.length;

    this.users.next(objects);
    this.pagination.next({
      length: count,
      size,
      page,
      lastPage: Math.max(0, Math.ceil(count / size) - 1),
    });

    return objects;
  }

  private updatePaginationCount(delta: number): void {
    const current = this.pagination.value;
    if (!current) {
      return;
    }

    const size = current.size || this.pageLimit;
    const length = Math.max(0, (current.length || 0) + delta);

    this.pagination.next({
      ...current,
      length,
      lastPage: Math.max(0, Math.ceil(length / size) - 1),
    });
  }

  getCustomersPage(
    page = this.pageIndex,
    limit = this.pageLimit,
  ): Observable<CustomerListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http
      .get<any>(API_USERS_URL, { params })
      .pipe(map((data: any) => this.toCustomerListResponse(data)));
  }

  getCustomersByCompany(
    companyId?: string,
    page = 0,
    limit = this.pageLimit,
  ): Observable<CustomerListResponse> {
    if (!companyId) {
      return this.getCustomersPage(page, limit);
    }

    const params = new HttpParams()
      .set('companyId', companyId)
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http
      .get<any>(`${API_USERS_URL}/by-company`, { params })
      .pipe(map((data: any) => this.toCustomerListResponse(data)));
  }

  searchCustomers(
    q: string,
    companyId?: string,
    page = 0,
    limit = this.pageLimit,
  ): Observable<CustomerListResponse> {
    let params = new HttpParams()
      .set('q', q)
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (companyId) {
      params = params.set('companyId', companyId);
    }

    return this.http
      .get<any>(`${API_USERS_URL}/search`, { params })
      .pipe(map((data: any) => this.toCustomerListResponse(data)));
  }

  getUserById(id: string): Observable<UserType> {
    if (!id) {
      return of(null as any);
    }
    // If we already have the user loaded, return it instead of making another request
    if (this.user.value && this.user.value.id === id) {
      return of(this.user.value);
    }
    this.loading.next(true);
    return this.http.get<any>(`${API_USERS_URL}/${id}`).pipe(
      map((data: any) => {
        this.user.next(data);
        return data;
      }),
      finalize(() => this.loading.next(false)),
    );
  }

  getCustomers(): Observable<UserType[]> {
    this.loading.next(true);
    const companyId = this.getCurrentCompanyId();
    const request$ = companyId
      ? this.getCustomersByCompany(companyId, this.pageIndex, this.pageLimit)
      : this.getCustomersPage(this.pageIndex, this.pageLimit);

    return request$.pipe(
      map((response) =>
        this.syncCustomerPage(response, this.pageIndex, this.pageLimit),
      ),
      finalize(() => this.loading.next(false)),
    );
  }

  private toCustomerListResponse(data: any): CustomerListResponse {
    const objects = Array.isArray(data?.objects)
      ? data.objects.filter(
          (user: UserType) => user?.role === RoleEnum.CUSTOMER,
        )
      : [];

    return {
      objects,
      count: data?.count ?? objects.length,
      isLast: data?.isLast ?? true,
    };
  }

  createCustomer(data: CustomerCreatePayload): Observable<UserType> {
    const companyId = this.getCurrentCompanyId();
    const payload: CustomerCreateRequest = {
      ...data,
      ...(companyId && {
        target: {
          company: companyId,
        },
      }),
    };

    return this.http.post<UserType>(API_USERS_URL, payload).pipe(
      map((created: UserType) => {
        this.users.next([...(this.users.value || []), created]);
        this.updatePaginationCount(1);
        return created;
      }),
    );
  }

  updateCustomer(
    id: string,
    data: CustomerUpdatePayload,
  ): Observable<UserType> {
    return this.http.put<UserType>(`${API_USERS_URL}/${id}`, data).pipe(
      map((updated: UserType) => {
        const updatedList = this.users.value.map((u) =>
          u.id === id ? updated : u,
        );
        this.user.next(updated);
        this.users.next(updatedList);
        return updated;
      }),
    );
  }

  deleteCustomer(id: string): Observable<void> {
    return this.http.delete<void>(`${API_USERS_URL}/${id}`).pipe(
      map(() => {
        const updatedList = this.users.value.filter((u) => u.id !== id);
        this.users.next(updatedList);
        this.updatePaginationCount(-1);
      }),
    );
  }
}
