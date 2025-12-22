import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { RouteType, RouteCoefficient } from '../../core/models/route.model';

export interface RouteCreatePayload {
  originId: string;
  destinationId: string;
  fare: number; // Admin-set fare in TND
  rank?: number;
  active?: boolean;
}

export interface RouteUpdatePayload {
  fare?: number;
  rank?: number;
  active?: boolean;
}

export interface CoefficientCreatePayload {
  routeId?: string | null;
  startDate: string;
  endDate: string;
  coefficient?: number;
  name?: string;
  priority?: number;
  active?: boolean;
}

export interface CoefficientUpdatePayload {
  startDate?: string;
  endDate?: string;
  coefficient?: number;
  name?: string;
  priority?: number;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private baseUrl = `${environment.apiBase}/routes`;
  private routes = new BehaviorSubject<RouteType[]>([]);
  private coefficients = new BehaviorSubject<RouteCoefficient[]>([]);
  private loading = new BehaviorSubject<boolean>(false);

  get routes$(): Observable<RouteType[]> {
    return this.routes.asObservable();
  }

  get coefficients$(): Observable<RouteCoefficient[]> {
    return this.coefficients.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  constructor(private http: HttpClient) {}

  // ==================== ROUTES ====================

  getRoutes(): Observable<RouteType[]> {
    this.loading.next(true);
    return this.http.get<RouteType[]>(this.baseUrl).pipe(
      map((data: RouteType[]) => {
        this.routes.next(data);
        this.loading.next(false);
        return data;
      })
    );
  }

  getActiveRoutes(): Observable<RouteType[]> {
    return this.http.get<RouteType[]>(`${this.baseUrl}/active`);
  }

  getRouteById(id: string): Observable<RouteType> {
    return this.http.get<RouteType>(`${this.baseUrl}/${id}`);
  }

  findRoute(originId: string, destinationId: string): Observable<RouteType> {
    return this.http.get<RouteType>(`${this.baseUrl}/find`, {
      params: { originId, destinationId },
    });
  }

  createRoute(payload: RouteCreatePayload): Observable<RouteType> {
    return this.http.post<RouteType>(this.baseUrl, payload).pipe(
      map((created: RouteType) => {
        this.routes.next([...this.routes.value, created]);
        return created;
      })
    );
  }

  updateRoute(id: string, changes: RouteUpdatePayload): Observable<RouteType> {
    return this.http.put<RouteType>(`${this.baseUrl}/${id}`, changes).pipe(
      map((updated: RouteType) => {
        const updatedList = this.routes.value.map((r) =>
          r.id === id ? updated : r
        );
        this.routes.next(updatedList);
        return updated;
      })
    );
  }

  deleteRoute(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      map(() => {
        this.routes.next(this.routes.value.filter((r) => r.id !== id));
      })
    );
  }

  // ==================== COEFFICIENTS ====================

  getRouteCoefficients(routeId: string): Observable<RouteCoefficient[]> {
    return this.http.get<RouteCoefficient[]>(
      `${this.baseUrl}/${routeId}/coefficients`
    );
  }

  getGlobalCoefficients(): Observable<RouteCoefficient[]> {
    return this.http
      .get<RouteCoefficient[]>(`${this.baseUrl}/coefficients/global`)
      .pipe(
        map((data: RouteCoefficient[]) => {
          this.coefficients.next(data);
          return data;
        })
      );
  }

  getActiveCoefficient(
    routeId: string | null,
    date: string
  ): Observable<{ routeId: string | null; date: string; coefficient: number }> {
    const params: any = { date };
    if (routeId) params.routeId = routeId;
    return this.http.get<any>(`${this.baseUrl}/coefficients/active`, {
      params,
    });
  }

  createCoefficient(
    payload: CoefficientCreatePayload
  ): Observable<RouteCoefficient> {
    return this.http
      .post<RouteCoefficient>(`${this.baseUrl}/coefficients`, payload)
      .pipe(
        map((created: RouteCoefficient) => {
          this.coefficients.next([...this.coefficients.value, created]);
          return created;
        })
      );
  }

  updateCoefficient(
    id: string,
    changes: CoefficientUpdatePayload
  ): Observable<RouteCoefficient> {
    return this.http
      .put<RouteCoefficient>(`${this.baseUrl}/coefficients/${id}`, changes)
      .pipe(
        map((updated: RouteCoefficient) => {
          const updatedList = this.coefficients.value.map((c) =>
            c.id === id ? updated : c
          );
          this.coefficients.next(updatedList);
          return updated;
        })
      );
  }

  deleteCoefficient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/coefficients/${id}`).pipe(
      map(() => {
        this.coefficients.next(
          this.coefficients.value.filter((c) => c.id !== id)
        );
      })
    );
  }

  // ==================== HELPERS ====================

  /**
   * Convert cents to display amount (e.g., 15000 -> 15.000)
   */
  centsToAmount(cents: number): number {
    return cents / 1000;
  }

  /**
   * Convert display amount to cents (e.g., 15.000 -> 15000)
   */
  amountToCents(amount: number): number {
    return Math.round(amount * 1000);
  }

  /**
   * Format fare for display
   */
  formatFare(cents: number): string {
    return (cents / 1000).toFixed(3);
  }
}
