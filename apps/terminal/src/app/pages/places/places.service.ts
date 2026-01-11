import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
import { StateType } from 'src/app/core/models/state-type';
import { CountryType } from 'src/app/core/models/country-type';

export interface PlaceCreatePayload {
  city?: string;
  location?: LonLatType;
  kind?: PlaceKindEnum;
  parentId?: string;
  stateId?: string;
  countryId?: string;
  address?: string;
  pickupInstructions?: string;
  isDefault?: boolean;
}

export interface PlaceUpdatePayload {
  city?: string;
  location?: LonLatType;
  kind?: PlaceKindEnum;
  parentId?: string;
  stateId?: string;
  countryId?: string;
  address?: string;
  pickupInstructions?: string;
  isDefault?: boolean;
}

export interface PaginatedPlaces {
  objects: PlaceType[];
  count: number;
  isLast: boolean;
}

export interface PlaceFilterType {
  searchString?: string;
  kind?: PlaceKindEnum;
  parentId?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private apiBase = environment.apiBase;
  private baseUrl = `${environment.apiBase}/places`;
  private places = new BehaviorSubject<PlaceType[]>([]);
  private infinitePlaces = new BehaviorSubject<PlaceType[]>([]);
  private states = new BehaviorSubject<StateType[]>([]);
  private countries = new BehaviorSubject<CountryType[]>([]);
  private isLastPlaces = new BehaviorSubject<boolean>(true);
  private isLastStates = new BehaviorSubject<boolean>(true);
  private pagination: BehaviorSubject<IPagination> = new BehaviorSubject(null);

  statesSearchString = '';
  countriesSearchString = '';
  placesSearchString = '';
  placesKindFilter?: PlaceKindEnum;
  placesParentIdFilter?: string;
  placesPageIndex = 0;
  placesPageLimit = 10;
  statesPageIndex = 0;
  statesPageLimit = 10;
  parentPlacesPageIndex = 0;

  get infinitePlaces$(): Observable<PlaceType[]> {
    return this.infinitePlaces.asObservable();
  }
  set infinitePlaces$(places: PlaceType[]) {
    this.infinitePlaces.next(places);
  }

  get places$(): Observable<PlaceType[]> {
    return this.places.asObservable();
  }

  get isLastPlaces$(): Observable<boolean> {
    return this.isLastPlaces.asObservable();
  }

  get isLastStates$(): Observable<boolean> {
    return this.isLastStates.asObservable();
  }

  get states$(): Observable<StateType[]> {
    return this.states.asObservable();
  }

  get countries$(): Observable<CountryType[]> {
    return this.countries.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  getCountries(): Observable<CountryType[]> {
    let params: any = {
      limit: 50,
      ...(this.countriesSearchString
        ? { searchString: this.countriesSearchString }
        : {}),
    };
    return this.http
      .get<PaginateResponse<CountryType>>(`${this.apiBase}/countries`, {
        params,
      })
      .pipe(
        map((data) => {
          this.countries.next(data.objects);
          return data.objects;
        })
      );
  }

  getStatesByCountry(countryId: string): Observable<StateType[]> {
    let params: any = {
      page: this.statesPageIndex,
      limit: this.statesPageLimit,
      ...(this.statesSearchString
        ? { searchString: this.statesSearchString }
        : {}),
    };
    return this.http
      .get<PaginateResponse>(`${this.apiBase}/states/by-country/${countryId}`, {
        params,
      })
      .pipe(
        map((data) => {
          this.isLastStates.next(data.isLast);
          this.states.next(data.objects);
          return data.objects;
        })
      );
  }

  resetStates(): void {
    this.states.next([]);
    this.statesSearchString = '';
    this.statesPageIndex = 0;
  }

  resetPlacesFilters(): void {
    this.placesSearchString = '';
    this.placesKindFilter = undefined;
    this.placesParentIdFilter = undefined;
  }

  resetPlaces(): void {
    this.places.next([]);
    this.resetPlacesFilters();
    this.placesPageIndex = 0;
  }

  // ========== Places (CITY) ==========
  getParentPlaces(): Observable<PlaceType[]> {
    let requestParams: any = {
      page: this.parentPlacesPageIndex,
      limit: this.placesPageLimit,
      kind: PlaceKindEnum.CITY,
      ...(this.placesSearchString
        ? { searchString: this.placesSearchString }
        : {}),
    };
    return this.http
      .get<PaginatedPlaces>(this.baseUrl, { params: requestParams })
      .pipe(
        map((data) => {
          this.isLastPlaces.next(data.isLast);
          this.infinitePlaces.next([
            ...(this.infinitePlaces.value || []),
            ...data.objects,
          ]);
          return data.objects;
        })
      );
  }

  getPlaces(): Observable<PlaceType[]> {
    let requestParams: any = {
      page: this.placesPageIndex,
      limit: this.placesPageLimit,
      kind: 'CITY',
      ...(this.placesSearchString
        ? { searchString: this.placesSearchString }
        : {}),
    };
    return this.http
      .get<PaginatedPlaces>(this.baseUrl, { params: requestParams })
      .pipe(
        map((data) => {
          this.pagination.next({
            page: this.placesPageIndex,
            size: this.placesPageLimit,
            length: data.count,
          });
          this.places.next(data.objects);
          return data.objects;
        })
      );
  }

  getPlaceById(id: string): Observable<PlaceType> {
    return this.http.get<PlaceType>(`${this.baseUrl}/${id}`);
  }

  createPlace(payload: PlaceCreatePayload): Observable<PlaceType> {
    return this.http.post<PlaceType>(this.baseUrl, payload).pipe(
      tap((created: PlaceType) => {
        if (created.kind === PlaceKindEnum.CITY || !created.kind) {
          this.places.next([...this.places.value, created]);
        }
      })
    );
  }

  updatePlace(id: string, changes: PlaceUpdatePayload): Observable<PlaceType> {
    return this.http.put<PlaceType>(`${this.baseUrl}/${id}`, changes).pipe(
      tap((updated: PlaceType) => {
        if (updated.kind === PlaceKindEnum.CITY || !updated.kind) {
          const updatedList = this.places.value.map((p) =>
            p.id === id ? updated : p
          );
          this.places.next(updatedList);
        }
      })
    );
  }

  deletePlace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.places.next(this.places.value.filter((p) => p.id !== id));
      })
    );
  }

  // ========== Sub-Places (POINT) Helpers ==========
  getSubPlacesByParent(parentId: string): Observable<SubPlaceType[]> {
    return this.http.get<SubPlaceType[]>(`${this.baseUrl}/${parentId}/places`);
  }
}
