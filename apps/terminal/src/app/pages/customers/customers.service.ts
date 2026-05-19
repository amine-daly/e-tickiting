import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  forkJoin,
  finalize,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';

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

export interface CustomerQueryOptions {
  searchTerm?: string;
  role?: string | null;
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

  private buildCustomerParams(
    companyId: string | undefined,
    page: number,
    limit: number,
    options: CustomerQueryOptions = {},
  ): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (companyId) {
      params = params.set('companyId', companyId);
    }

    const role = options.role?.trim();
    if (role) {
      params = params.set('role', role);
    }

    const searchTerm = options.searchTerm?.trim();
    if (searchTerm) {
      params = params.set('q', searchTerm);
    }

    return params;
  }

  private fetchCustomerPage(
    companyId: string | undefined,
    page: number,
    limit: number,
    options: CustomerQueryOptions = {},
  ): Observable<CustomerListResponse> {
    const searchTerm = options.searchTerm?.trim();
    const endpoint = searchTerm
      ? `${API_USERS_URL}/search`
      : `${API_USERS_URL}/by-company`;
    const params = this.buildCustomerParams(companyId, page, limit, options);

    return this.http.get<CustomerListResponse>(endpoint, { params });
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

  getCustomersByCompany(
    companyId?: string,
    page = 0,
    limit = this.pageLimit,
    role?: string,
  ): Observable<CustomerListResponse> {
    const params = this.buildCustomerParams(companyId, page, limit, { role });

    return this.http.get<CustomerListResponse>(`${API_USERS_URL}/by-company`, {
      params,
    });
  }

  searchCustomers(
    q: string,
    companyId?: string,
    page = 0,
    limit = this.pageLimit,
    role?: string,
  ): Observable<CustomerListResponse> {
    const params = this.buildCustomerParams(companyId, page, limit, {
      searchTerm: q,
      role,
    });

    return this.http.get<CustomerListResponse>(`${API_USERS_URL}/search`, {
      params,
    });
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

  getCustomers(options: CustomerQueryOptions = {}): Observable<UserType[]> {
    this.loading.next(true);
    const companyId = this.getCurrentCompanyId();
    return this.fetchCustomerPage(
      companyId,
      this.pageIndex,
      this.pageLimit,
      options,
    ).pipe(
      map((response) => {
        return this.syncCustomerPage(response, this.pageIndex, this.pageLimit);
      }),
      finalize(() => this.loading.next(false)),
    );
  }

  fetchAllCustomers(
    options: CustomerQueryOptions = {},
  ): Observable<UserType[]> {
    const companyId = this.getCurrentCompanyId();
    const pageSize = 100;

    return this.fetchCustomerPage(companyId, 0, pageSize, options).pipe(
      switchMap((firstPage) => {
        const total = firstPage?.count ?? firstPage?.objects?.length ?? 0;
        if (total <= pageSize) {
          return of(firstPage?.objects ?? []);
        }

        const totalPages = Math.ceil(total / pageSize);
        const pageRequests = Array.from(
          { length: Math.max(0, totalPages - 1) },
          (_, index) =>
            this.fetchCustomerPage(companyId, index + 1, pageSize, options),
        );

        return forkJoin(pageRequests).pipe(
          map((responses) =>
            [firstPage, ...responses].flatMap((page) => page?.objects ?? []),
          ),
        );
      }),
    );
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
