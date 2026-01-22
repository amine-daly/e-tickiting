import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, finalize, map, Observable, of } from 'rxjs';
import { IPagination } from 'src/app/core/models/paginate-model';
import { PhoneType, UserType } from 'src/app/core/models/user-type';

const API_USERS_URL = '/api/users';

export interface CustomerCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: PhoneType;
}

export interface CustomerUpdatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  phone?: PhoneType;
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
        console.log(
          '🚀 ~ CustomersService ~ getUserById ~ this.user:',
          this.user.value,
        );
        return data;
      }),
      // ensure loading flag is cleared even on error
      // note: use finalize to handle completion
      finalize(() => this.loading.next(false)),
    );
  }

  getCustomers(page = 0, limit = 10): Observable<UserType[]> {
    this.loading.next(true);
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<any>(API_USERS_URL, { params }).pipe(
      map((data: any) => {
        const objects = data?.objects ?? [];
        const count = data?.count ?? objects.length;
        this.users.next(objects);
        this.pagination.next({
          length: count,
          size: limit,
          page,
          lastPage: Math.max(0, Math.ceil(count / limit) - 1),
        });
        return objects;
      }),
      finalize(() => this.loading.next(false)),
    );
  }

  createCustomer(data: CustomerCreatePayload): Observable<UserType> {
    return this.http.post<UserType>(API_USERS_URL, data).pipe(
      map((created: UserType) => {
        this.users.next([...this.users.value, created]);
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
      }),
    );
  }
}
