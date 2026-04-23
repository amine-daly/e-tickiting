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
  lang?: BookingLang;
  seatNo?: string;
}

export type BookingLang = 'fr-fr' | 'en-gb' | 'ar-sa';

export interface BookingResponse {
  id: string;
  tripId: string;
  orderId?: string;
  companyId: string;
  posId?: string;
  segmentIds: string[];
  expressId?: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId?: string;
  guestFirstName?: string;
  guestLastName?: string;
  seatNo?: string;
  appliedPrice: number;
  currency: string;
  lang: BookingLang;
  status: string;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

// ── Group Booking (Order) interfaces ────────────────────────────────

export interface PassengerEntry {
  passengerId?: string;
  firstName?: string;
  lastName?: string;
  seatNo?: string;
}

export interface GroupBookingRequest {
  tripId: string;
  fromPlaceId: string;
  toPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  contactCustomerId: string;
  idempotencyKey: string;
  lang?: BookingLang;
  passengers: PassengerEntry[];
}

export interface OrderPassenger {
  passengerId?: string;
  firstName?: string;
  lastName?: string;
  seatNo?: string;
  ticketId?: string;
}

export interface GroupBookingResponse {
  orderId: string;
  tripId: string;
  companyId: string;
  posId?: string;
  contactCustomerId: string;
  totalPrice: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  passengers: OrderPassenger[];
  tickets: BookingResponse[];
}

export interface GroupSeatAssignment {
  ticketId: string;
  seatNo: string;
}

export interface GroupSeatUpdateRequest {
  assignments: GroupSeatAssignment[];
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
    return this.http.post<BookingResponse>(this.bookingUrl, {
      ...request,
      lang: this.resolveBookingLang(request.lang),
    });
  }

  private resolveBookingLang(lang?: string | null): BookingLang {
    const browserLang =
      lang ??
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('lang')
        : null);
    switch (browserLang) {
      case 'en-gb':
      case 'ar-sa':
      case 'fr-fr':
        return browserLang;
      default:
        return 'fr-fr';
    }
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

  updateSeat(ticketId: string, seatNo: string): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(
      `${this.bookingUrl}/${ticketId}/seat`,
      { seatNo },
    );
  }

  // ── Group Booking (Order) ───────────────────────────────────────────

  createGroupBooking(
    request: GroupBookingRequest,
  ): Observable<GroupBookingResponse> {
    return this.http.post<GroupBookingResponse>(`${this.bookingUrl}/group`, {
      ...request,
      lang: this.resolveBookingLang(request.lang),
    });
  }

  confirmOrder(orderId: string): Observable<GroupBookingResponse> {
    return this.http.post<GroupBookingResponse>(
      `${this.bookingUrl}/group/${orderId}/confirm`,
      {},
    );
  }

  cancelOrder(orderId: string): Observable<GroupBookingResponse> {
    return this.http.post<GroupBookingResponse>(
      `${this.bookingUrl}/group/${orderId}/cancel`,
      {},
    );
  }

  cancelOrderPassenger(
    orderId: string,
    ticketId: string,
  ): Observable<GroupBookingResponse> {
    return this.http.post<GroupBookingResponse>(
      `${this.bookingUrl}/group/${orderId}/tickets/${ticketId}/cancel`,
      {},
    );
  }

  updateGroupSeats(
    orderId: string,
    request: GroupSeatUpdateRequest,
  ): Observable<GroupBookingResponse> {
    return this.http.patch<GroupBookingResponse>(
      `${this.bookingUrl}/group/${orderId}/seats`,
      request,
    );
  }

  getOccupiedSeats(tripId: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.bookingUrl}/occupied-seats/${tripId}`,
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
