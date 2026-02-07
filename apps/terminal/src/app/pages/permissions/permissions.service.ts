import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  finalize,
  forkJoin,
  map,
  tap,
} from 'rxjs';
import {
  PermissionDefinitionType,
  PermissionInput,
  PermissionType,
} from 'src/app/core/models/permission-type';

const API_PERMISSIONS_URL = '/api/permissions';
const API_PERMISSION_DEFINITIONS_URL = '/api/permission-definitions';

type Paginated<T> = {
  objects: T[];
  count: number;
  isLast: boolean;
};

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private permissions = new BehaviorSubject<PermissionType[]>([]);
  private definitionsSubject = new BehaviorSubject<PermissionDefinitionType[]>(
    [],
  );
  private loadingSubject = new BehaviorSubject<boolean>(false);

  get permissions$(): Observable<PermissionType[]> {
    return this.permissions.asObservable();
  }

  get definitions$(): Observable<PermissionDefinitionType[]> {
    return this.definitionsSubject.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  constructor(private http: HttpClient) {}

  loadInitialData(): Observable<{
    permissions: PermissionType[];
    definitions: PermissionDefinitionType[];
  }> {
    this.loadingSubject.next(true);
    return forkJoin({
      permissions: this.getPermissions(),
      definitions: this.getPermissionDefinitions(),
    }).pipe(finalize(() => this.loadingSubject.next(false)));
  }

  getPermissions(): Observable<PermissionType[]> {
    const posId = localStorage.getItem('posId');
    const url = posId
      ? `${API_PERMISSIONS_URL}/by-target?posId=${encodeURIComponent(posId)}`
      : API_PERMISSIONS_URL;
    return this.http.get<Paginated<PermissionType>>(url).pipe(
      map((data) => data?.objects ?? []),
      tap((permissions) => this.permissions.next(permissions)),
    );
  }

  getPermissionDefinitions(): Observable<PermissionDefinitionType[]> {
    return this.http
      .get<Paginated<PermissionDefinitionType>>(API_PERMISSION_DEFINITIONS_URL)
      .pipe(
        map((data) => data?.objects ?? []),
        tap((definitions) => this.definitionsSubject.next(definitions)),
      );
  }

  createPermission(payload: PermissionInput): Observable<PermissionType> {
    return this.http.post<PermissionType>(API_PERMISSIONS_URL, payload).pipe(
      tap((created) => {
        this.permissions.next([...this.permissions.value, created]);
      }),
    );
  }

  updatePermission(
    id: string,
    payload: PermissionInput,
  ): Observable<PermissionType> {
    return this.http
      .put<PermissionType>(`${API_PERMISSIONS_URL}/${id}`, payload)
      .pipe(
        tap((updated) => {
          const updatedList = this.permissions.value.map((perm) =>
            perm.id === id ? updated : perm,
          );
          this.permissions.next(updatedList);
        }),
      );
  }

  deletePermission(id: string): Observable<void> {
    return this.http.delete<void>(`${API_PERMISSIONS_URL}/${id}`).pipe(
      tap(() => {
        const updatedList = this.permissions.value.filter(
          (perm) => perm.id !== id,
        );
        this.permissions.next(updatedList);
      }),
    );
  }
}
