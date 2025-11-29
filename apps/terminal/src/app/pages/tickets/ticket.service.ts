import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { Ticket, TicketStatus } from '../../core/models/ticket.model';

export interface TicketEmailResponse {
  status: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly baseUrl = '/api/tickets';
  private loading = new BehaviorSubject<boolean>(false);
  private tickets = new BehaviorSubject<Ticket[]>([]);

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  get tickets$(): Observable<Ticket[]> {
    return this.tickets.asObservable();
  }

  constructor(private http: HttpClient) {}

  fetchTickets(): Observable<Ticket[]> {
    this.loading.next(true);
    return this.http.get<Ticket[]>(this.baseUrl).pipe(
      tap((tickets) => this.tickets.next(tickets ?? [])),
      catchError((error) => {
        this.tickets.next([]);
        return throwError(() => error);
      }),
      finalize(() => this.loading.next(false))
    );
  }

  updateStatus(id: string, status: TicketStatus): Observable<Ticket> {
    return this.http
      .put<Ticket>(`${this.baseUrl}/${id}`, { status })
      .pipe(tap((updated) => this.mergeTicket(updated)));
  }

  sendEmail(id: string, email?: string): Observable<TicketEmailResponse> {
    const payload = email ? { email } : {};
    return this.http.post<TicketEmailResponse>(
      `${this.baseUrl}/${id}/send-email`,
      payload
    );
  }

  private mergeTicket(updated: Ticket): void {
    const current = this.tickets.value ?? [];
    const exists = current.some((ticket) => ticket.id === updated.id);
    this.tickets.next(
      exists
        ? current.map((ticket) =>
            ticket.id === updated.id ? { ...ticket, ...updated } : ticket
          )
        : [...current, updated]
    );
  }
}
