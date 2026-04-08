import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { CountryType } from 'src/app/core/models/country-type';
import {
  IPagination,
  PaginateResponse,
} from 'src/app/core/models/paginate-model';
import { StateType } from 'src/app/core/models/state-type';
import { PlaceType } from '../../core/models/place-type';

export interface PlaceCreatePayload {
  city?: string;
  stateId?: string;
  countryId?: string;
}

export interface PlaceUpdatePayload {
  city?: string;
  stateId?: string;
  countryId?: string;
}

export interface PaginatedPlaces {
  objects: PlaceType[];
  count: number;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly apiBase = environment.apiBase;
  private readonly baseUrl = `${environment.apiBase}/places`;
  private readonly places = new BehaviorSubject<PlaceType[]>([]);
  private readonly states = new BehaviorSubject<StateType[]>([]);
  private readonly countries = new BehaviorSubject<CountryType[]>([]);
  private readonly isLastStates = new BehaviorSubject<boolean>(true);
  private readonly pagination = new BehaviorSubject<IPagination | null>(null);

  statesSearchString = '';
  countriesSearchString = '';
  placesSearchString = '';
  placesPageIndex = 0;
  placesPageLimit = 10;
  statesPageIndex = 0;
  statesPageLimit = 10;

  get places$(): Observable<PlaceType[]> {
    return this.places.asObservable();
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

  get pagination$(): Observable<IPagination | null> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  getCountries(): Observable<CountryType[]> {
    const params: Record<string, string | number> = {
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
        }),
      );
  }

  getStatesByCountry(countryId: string): Observable<StateType[]> {
    const params: Record<string, string | number> = {
      page: this.statesPageIndex,
      limit: this.statesPageLimit,
      ...(this.statesSearchString
        ? { searchString: this.statesSearchString }
        : {}),
    };

    return this.http
      .get<
        PaginateResponse<StateType>
      >(`${this.apiBase}/states/by-country/${countryId}`, { params })
      .pipe(
        map((data) => {
          this.isLastStates.next(data.isLast);
          this.states.next([...this.states.value, ...data.objects]);
          return data.objects;
        }),
      );
  }

  resetStates(): void {
    this.states.next([]);
    this.statesSearchString = '';
    this.statesPageIndex = 0;
  }

  resetPlaces(): void {
    this.places.next([]);
    this.placesSearchString = '';
    this.placesPageIndex = 0;
  }

  getPlaces(): Observable<PlaceType[]> {
    const posId = localStorage.getItem('posId');
    const params: Record<string, string | number> = {
      page: this.placesPageIndex,
      limit: this.placesPageLimit,
      ...(posId ? { posId } : {}),
      ...(this.placesSearchString
        ? { searchString: this.placesSearchString }
        : {}),
    };

    return this.http
      .get<PaginatedPlaces>(
        posId ? `${this.baseUrl}/by-target` : this.baseUrl,
        { params },
      )
      .pipe(
        map((data) => {
          this.pagination.next({
            page: this.placesPageIndex,
            size: this.placesPageLimit,
            length: data.count,
          });
          this.places.next(data.objects);
          return data.objects;
        }),
      );
  }

  getPlaceById(id: string): Observable<PlaceType> {
    return this.http.get<PlaceType>(`${this.baseUrl}/${id}`);
  }

  createPlace(payload: PlaceCreatePayload): Observable<PlaceType> {
    return this.http
      .post<PlaceType>(this.baseUrl, {
        ...payload,
        target: { pos: localStorage.getItem('posId') },
      })
      .pipe(
        tap((created: PlaceType) => {
          this.places.next([...this.places.value, created]);
        }),
      );
  }

  updatePlace(id: string, changes: PlaceUpdatePayload): Observable<PlaceType> {
    return this.http.put<PlaceType>(`${this.baseUrl}/${id}`, changes).pipe(
      tap((updated: PlaceType) => {
        const updatedList = this.places.value.map((place) =>
          place.id === id ? updated : place,
        );
        this.places.next(updatedList);
      }),
    );
  }

  deletePlace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.places.next(this.places.value.filter((place) => place.id !== id));
      }),
    );
  }
}
