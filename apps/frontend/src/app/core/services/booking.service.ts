import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket } from '../models/ticket.model';
import {
  BookingRequest,
  BookingResponse,
  FrontofficeCreateHoldRequest,
  FrontofficeHoldResponse,
} from '../models/booking.model';

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
    return this.http.post<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/holds`,
      request,
    );
  }

  getFrontofficeHold(holdToken: string): Observable<FrontofficeHoldResponse> {
    return this.http.get<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/holds/${holdToken}`,
    );
  }

  confirmFrontofficeHold(
    holdToken: string,
  ): Observable<FrontofficeHoldResponse> {
    return this.http.post<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/holds/${holdToken}/confirm`,
      {},
    );
  }

  cancelFrontofficeHold(
    holdToken: string,
  ): Observable<FrontofficeHoldResponse> {
    return this.http.post<FrontofficeHoldResponse>(
      `${this.frontofficeUrl}/holds/${holdToken}/cancel`,
      {},
    );
  }

  getRouteOccupiedSeats(
    tripId: string,
    originPlaceId: string,
    destinationPlaceId: string,
  ): Observable<string[]> {
    const params = new URLSearchParams({
      tripId,
      originPlaceId,
      destinationPlaceId,
    });
    return this.http.get<string[]>(
      `${this.frontofficeUrl}/occupied-seats?${params.toString()}`,
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
