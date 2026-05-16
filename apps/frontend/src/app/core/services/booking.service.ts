import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket } from '../models/ticket.model';
import {
  BookingRequest,
  BookingResponse,
  FrontofficeCreateHoldRequest,
  FrontofficeHoldResponse,
  OperationSuccessResponse,
} from '../models/booking.model';
import { TargetInput } from '../models/shared.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private baseUrl = `${environment.apiBase}/bookings`;
  private frontofficeUrl = `${environment.apiBase}/frontoffice/bookings`;

  constructor(private http: HttpClient) {}

  createBooking(request: BookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(this.baseUrl, request);
  }

  confirmBooking(ticketId: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(
      `${this.baseUrl}/${ticketId}/confirm`,
      {},
    );
  }

  cancelBooking(ticketId: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(
      `${this.baseUrl}/${ticketId}/cancel`,
      {},
    );
  }

  createFrontofficeHold(
    request: FrontofficeCreateHoldRequest,
  ): Observable<FrontofficeHoldResponse> {
    const endpoint = request.passengers?.length
      ? `${this.frontofficeUrl}/group`
      : this.frontofficeUrl;
    return this.http.post<FrontofficeHoldResponse>(endpoint, request);
  }

  getFrontofficeHold(holdToken: string): Observable<FrontofficeHoldResponse> {
    return this.http.get<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/holds/${holdToken}`,
    );
  }

  confirmFrontofficeHold(
    hold: FrontofficeHoldResponse,
  ): Observable<FrontofficeHoldResponse> {
    const targetPayload = this.buildTargetPayload(hold.companyId || undefined);
    if (hold.groupBooking && hold.orderId) {
      return this.http.post<FrontofficeHoldResponse>(
        `${this.frontofficeUrl}/group/${hold.orderId}/confirm`,
        targetPayload ?? {},
      );
    }

    const ticketId = hold.passengers?.[0]?.ticketId;
    return this.http.post<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/${ticketId}/confirm`,
      targetPayload ?? {},
    );
  }

  cancelFrontofficeHold(
    hold: FrontofficeHoldResponse,
  ): Observable<OperationSuccessResponse> {
    if (hold.groupBooking && hold.orderId) {
      return this.http.post<OperationSuccessResponse>(
        `${this.frontofficeUrl}/group/${hold.orderId}/cancel`,
        {},
      );
    }

    const ticketId = hold.passengers?.[0]?.ticketId;
    return this.http.post<OperationSuccessResponse>(
      `${this.frontofficeUrl}/${ticketId}/cancel`,
      {},
    );
  }

  private buildTargetPayload(
    companyId?: string,
  ): { target: TargetInput } | null {
    if (!companyId) {
      return null;
    }
    return {
      target: {
        company: companyId,
      },
    };
  }

  getRouteOccupiedSeats(
    tripId: string,
    originPlaceId: string,
    destinationPlaceId: string,
  ): Observable<string[]> {
    const params = new HttpParams()
      .set('tripId', tripId)
      .set('originPlaceId', originPlaceId)
      .set('destinationPlaceId', destinationPlaceId);
    return this.http.get<string[]>(
      `${this.frontofficeUrl}/route-occupied-seats`,
      {
        params,
      },
    );
  }

  getTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${environment.apiBase}/tickets`);
  }

  getTicketById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${environment.apiBase}/tickets/${id}`);
  }

  getTicketDocument(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiBase}/tickets/${id}/document`);
  }
}
