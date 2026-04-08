import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { Ticket, TicketStatus } from '../../core/models/ticket.model';
import { PaginateResponse } from '../../core/models/paginate-model';

export interface TicketEmailResponse {
  status: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly ticketsUrl = '/api/tickets';
  private readonly bookingsUrl = '/api/bookings';
  private loading = new BehaviorSubject<boolean>(false);
  private tickets = new BehaviorSubject<Ticket[]>([]);
  private pagination = new BehaviorSubject<{ count: number; isLast: boolean }>({
    count: 0,
    isLast: true,
  });

  pageLimit = 10;
  pageIndex = 0;

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get tickets$(): Observable<Ticket[]> {
    return this.tickets.asObservable();
  }

  get pagination$(): Observable<{ count: number; isLast: boolean }> {
    return this.pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  fetchTickets(status?: TicketStatus): Observable<Ticket[]> {
    const posId = localStorage.getItem('posId');
    console.log('🚀 ~ TicketService ~ fetchTickets ~ posId:', posId);
    if (!posId) {
      this.tickets.next([]);
      return throwError(() => new Error('POS_ID_MISSING'));
    }
    this.loading.next(true);
    let params = new HttpParams()
      .set('page', this.pageIndex.toString())
      .set('limit', this.pageLimit.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http
      .get<
        PaginateResponse<Ticket>
      >(`${this.ticketsUrl}/by-pos/${posId}`, { params })
      .pipe(
        map((res) => {
          console.log('🚀 ~ TicketService ~ fetchTickets ~ res:', res);
          const objects = Array.isArray(res?.objects) ? res.objects : [];
          this.tickets.next(objects);
          this.pagination.next({
            count: res?.count ?? objects.length,
            isLast: res?.isLast ?? true,
          });
          return objects;
        }),
        catchError((error) => {
          this.tickets.next([]);
          return throwError(() => error);
        }),
        finalize(() => this.loading.next(false)),
      );
  }

  confirmTicket(ticketId: string): Observable<Ticket> {
    return this.http
      .post<Ticket>(`${this.bookingsUrl}/${ticketId}/confirm`, {})
      .pipe(tap((updated) => this.mergeTicket(updated)));
  }

  cancelTicket(ticketId: string): Observable<Ticket> {
    return this.http
      .post<Ticket>(`${this.bookingsUrl}/${ticketId}/cancel`, {})
      .pipe(tap((updated) => this.mergeTicket(updated)));
  }

  sendEmail(id: string): Observable<TicketEmailResponse> {
    return this.http.post<TicketEmailResponse>(
      `${this.ticketsUrl}/${id}/send-email`,
      {},
    );
  }

  private mergeTicket(updated: Ticket): void {
    const current = this.tickets.value ?? [];
    const exists = current.some((ticket) => ticket.id === updated.id);
    this.tickets.next(
      exists
        ? current.map((ticket) =>
            ticket.id === updated.id ? { ...ticket, ...updated } : ticket,
          )
        : [...current, updated],
    );
  }
}
