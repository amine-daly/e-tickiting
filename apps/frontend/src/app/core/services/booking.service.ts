import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket } from '../models/ticket.model';

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
  expressSegmentId?: string;
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

@Injectable({ providedIn: 'root' })
export class BookingService {
  private baseUrl = `${environment.apiBase}/bookings`;

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
