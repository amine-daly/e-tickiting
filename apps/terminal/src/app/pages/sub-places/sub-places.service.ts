import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import {
  PlaceType,
  SubPlaceType,
  PlaceKindEnum,
  LonLatType,
} from '../../core/models/place-type';
import {
  IPagination,
  PaginateResponse,
} from 'src/app/core/models/paginate-model';

export interface SubPlaceCreatePayload {
  address?: string;
  location?: LonLatType;
  pickupInstructions?: string;
  isDefault?: boolean;
  parentId: string;
}

export interface SubPlaceUpdatePayload {
  address?: string;
  location?: LonLatType;
  pickupInstructions?: string;
  isDefault?: boolean;
  parentId?: string;
}

@Injectable({ providedIn: 'root' })
export class SubPlacesService {
  private apiBase = environment.apiBase;
  private baseUrl = `${environment.apiBase}/sub-places`;

  private subPlaces = new BehaviorSubject<SubPlaceType[]>([]);
  private pagination: BehaviorSubject<IPagination> = new BehaviorSubject(null);

  searchString = '';
  pageIndex = 0;
  pageLimit = 10;

  get subPlaces$(): Observable<SubPlaceType[]> {
    return this.subPlaces.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  getAllSubPlaces(): Observable<SubPlaceType[]> {
    const posId = localStorage.getItem('posId');
    let params: any = {
      page: this.pageIndex,
      limit: this.pageLimit,
      ...(posId ? { posId } : {}),
      ...(this.searchString ? { searchString: this.searchString } : {}),
    };

    return this.http
      .get<PaginateResponse<SubPlaceType>>(this.baseUrl, { params })
      .pipe(
        map((data) => {
          this.pagination.next({
            page: this.pageIndex,
            size: this.pageLimit,
            length: data.count,
          });
          this.subPlaces.next(data.objects);
          return data.objects;
        }),
      );
  }

  getSubPlacesByParent(parentId: string): Observable<SubPlaceType[]> {
    return this.http.get<SubPlaceType[]>(
      `${this.apiBase}/places/${parentId}/places`,
    );
  }

  getById(id: string): Observable<SubPlaceType> {
    return this.http.get<SubPlaceType>(`${this.baseUrl}/${id}`);
  }

  createSubPlace(payload: SubPlaceCreatePayload): Observable<SubPlaceType> {
    return this.http.post<SubPlaceType>(this.baseUrl, payload).pipe(
      tap((created) => {
        this.subPlaces.next([...this.subPlaces.value, created]);
      }),
    );
  }

  updateSubPlace(
    id: string,
    changes: SubPlaceUpdatePayload,
  ): Observable<SubPlaceType> {
    return this.http.put<SubPlaceType>(`${this.baseUrl}/${id}`, changes).pipe(
      tap((updated) => {
        const updatedList = this.subPlaces.value.map((sp) =>
          sp.id === id ? updated : sp,
        );
        this.subPlaces.next(updatedList);
      }),
    );
  }

  deleteSubPlace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.subPlaces.next(this.subPlaces.value.filter((sp) => sp.id !== id));
      }),
    );
  }

  resetFilters(): void {
    this.searchString = '';
    this.pageIndex = 0;
  }

  reset(): void {
    this.subPlaces.next([]);
    this.resetFilters();
  }
}
