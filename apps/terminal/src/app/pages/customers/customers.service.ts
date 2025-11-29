import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { PhoneType, UserType } from 'src/app/modules/auth/models/user-type';

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
    []
  );
  private loading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false
  );

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get users$(): Observable<UserType[]> {
    return this.users.asObservable();
  }
  set users$(value: UserType[]) {
    this.users.next(value);
  }

  constructor(private http: HttpClient) {}

  getCustomers(): Observable<UserType[]> {
    this.loading.next(true);
    return this.http.get<any>(API_USERS_URL).pipe(
      map((data: any) => {
        this.loading.next(false);
        this.users.next(data.objects);
        return data.objects;
      })
    );
  }

  createCustomer(data: CustomerCreatePayload): Observable<UserType> {
    return this.http.post<UserType>(API_USERS_URL, data).pipe(
      map((created: UserType) => {
        this.users.next([...this.users.value, created]);
        return created;
      })
    );
  }

  updateCustomer(
    id: string,
    data: CustomerUpdatePayload
  ): Observable<UserType> {
    return this.http.put<UserType>(`${API_USERS_URL}/${id}`, data).pipe(
      map((updated: UserType) => {
        const updatedList = this.users.value.map((u) =>
          u.id === id ? updated : u
        );
        this.users.next(updatedList);
        return updated;
      })
    );
  }

  deleteCustomer(id: string): Observable<void> {
    return this.http.delete<void>(`${API_USERS_URL}/${id}`).pipe(
      map(() => {
        const updatedList = this.users.value.filter((u) => u.id !== id);
        this.users.next(updatedList);
      })
    );
  }
}
