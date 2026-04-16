import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface BookingRequest {
  tripId: string;
  fromPlaceId: string;
  toPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId: string;
  idempotencyKey: string;
}

export interface BookingResponse {
  id: string;
  tripId: string;
  companyId: string;
  posId?: string;
  segmentIds: string[];
  expressId?: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId: string;
  appliedPrice: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: { countryCode: string; number: string };
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private bookingUrl = `${environment.apiBase}/bookings`;
  private userUrl = `${environment.apiBase}/users`;

  constructor(private http: HttpClient) {}

  createBooking(request: BookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(this.bookingUrl, request);
  }

  confirmBooking(ticketId: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(
      `${this.bookingUrl}/${ticketId}/confirm`,
      {},
    );
  }

  cancelBooking(ticketId: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(
      `${this.bookingUrl}/${ticketId}/cancel`,
      {},
    );
  }

  searchUsers(
    q: string,
    companyId?: string,
    page = 0,
    limit = 20,
  ): Observable<{
    objects: UserSearchResult[];
    count: number;
    isLast: boolean;
  }> {
    let params = new HttpParams()
      .set('q', q)
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (companyId) {
      params = params.set('companyId', companyId);
    }
    return this.http.get<{
      objects: UserSearchResult[];
      count: number;
      isLast: boolean;
    }>(`${this.userUrl}/search`, { params });
  }
}
