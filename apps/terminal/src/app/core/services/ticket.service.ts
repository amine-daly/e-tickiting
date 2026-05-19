import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Ticket, TicketStatus } from '../models/ticket.model';
import { PaginateResponse } from '../models/paginate-model';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private baseUrl = `${environment.apiBase}/tickets`;
  private _tickets = new BehaviorSubject<Ticket[]>([]);
  private _loading = new BehaviorSubject<boolean>(false);
  private _pagination = new BehaviorSubject<{ count: number; isLast: boolean }>(
    {
      count: 0,
      isLast: true,
    },
  );

  get tickets$(): Observable<Ticket[]> {
    return this._tickets.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this._loading.asObservable();
  }

  get pagination$(): Observable<{ count: number; isLast: boolean }> {
    return this._pagination.asObservable();
  }

  constructor(private http: HttpClient) {}

  fetchTicketsByPos(
    posId: string,
    page = 0,
    limit = 10,
    status?: TicketStatus,
  ): Observable<PaginateResponse<Ticket>> {
    this._loading.next(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http
      .get<
        PaginateResponse<Ticket>
      >(`${this.baseUrl}/by-pos/${posId}`, { params })
      .pipe(
        map((res) => {
          this._tickets.next(res.objects);
          this._pagination.next({
            count: res.count ?? 0,
            isLast: res.isLast ?? true,
          });
          return res;
        }),
        finalize(() => this._loading.next(false)),
      );
  }

  getTicketById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  getTicketDocument(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}/document`);
  }

  getOrderDocument(orderId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders/${orderId}/document`);
  }

  sendTicketEmail(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/send-email`, {});
  }
}
