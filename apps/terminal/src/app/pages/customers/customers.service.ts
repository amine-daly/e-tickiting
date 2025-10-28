import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { UserType } from 'src/app/modules/auth/models/user-type';

const API_USERS_URL = '/api/users';

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

  getAll(): Observable<any> {
    this.loading.next(true);
    return this.http.get<any>(API_USERS_URL).pipe(
      map((data: any) => {
        this.loading.next(false);
        this.users.next(data.objects);
        return data.objects;
      })
    );
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(API_USERS_URL, data).pipe(
      map((created: any) => {
        this.users.next([...this.users.value, created]);
        return created;
      })
    );
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${API_USERS_URL}/${id}`, data).pipe(
      map((updated: any) => {
        console.log('🚀 ~ CustomersService ~ update ~ updated:', updated);
        const updatedList = this.users.value.map((u) =>
          u.id === id ? updated : u
        );
        this.users.next(updatedList);
        return updated;
      })
    );
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${API_USERS_URL}/${id}`).pipe(
      map(() => {
        const updatedList = this.users.value.filter((u) => u.id !== id);
        this.users.next(updatedList);
      })
    );
  }
}
