import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {
  NgbDropdownModule,
  NgbModal,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import { AlertService } from '../../core/services/alert.service';
import { Ticket, TicketStatus } from '../../core/models/ticket.model';
import { TicketService } from './ticket.service';
import { BookingService } from '../../core/services/booking.service';
import { TicketPrintService } from '../../core/services/ticket-print.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { FormsModule } from '@angular/forms';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NgbDropdownModule,
    NgbTooltipModule,
    TranslateModule,
    PaginationComponent,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
  ],
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets$ = this.ticketService.tickets$;
  displayRows$ = this.tickets$.pipe(
    map((tickets) => this.buildDisplayRows(tickets)),
  );
  loading$ = this.ticketService.loading$;
  pagination$ = this.ticketService.pagination$;

  page = 1;
  pageSize = this.ticketService.pageLimit;
  filterStatus: TicketStatus | null = null;

  statusFilterOptions: Array<{ value: TicketStatus; labelKey: string }> = [
    { value: TicketStatus.PENDING, labelKey: 'TICKETS.STATUS.PENDING' },
    { value: TicketStatus.CONFIRMED, labelKey: 'TICKETS.STATUS.CONFIRMED' },
    { value: TicketStatus.CANCELLED, labelKey: 'TICKETS.STATUS.CANCELLED' },
    { value: TicketStatus.EXPIRED, labelKey: 'TICKETS.STATUS.EXPIRED' },
  ];

  statusLabelMap: Record<TicketStatus, string> = {
    [TicketStatus.PENDING]: 'TICKETS.STATUS.PENDING',
    [TicketStatus.CONFIRMED]: 'TICKETS.STATUS.CONFIRMED',
    [TicketStatus.CANCELLED]: 'TICKETS.STATUS.CANCELLED',
    [TicketStatus.EXPIRED]: 'TICKETS.STATUS.EXPIRED',
  };

  badgeClass: Record<TicketStatus, string> = {
    [TicketStatus.PENDING]: 'badge-light-primary',
    [TicketStatus.CONFIRMED]: 'badge-light-success',
    [TicketStatus.CANCELLED]: 'badge-light-danger',
    [TicketStatus.EXPIRED]: 'badge-light-warning',
  };

  selectedTicket: Ticket | null = null;
  selectedTickets: Ticket[] = [];
  private subscriptions = new Subscription();
  statusUpdating: Record<string, boolean> = {};
  emailSending: Record<string, boolean> = {};
  printing: Record<string, boolean> = {};

  constructor(
    private ticketService: TicketService,
    private bookingService: BookingService,
    private ticketPrintService: TicketPrintService,
    private modalService: NgbModal,
    private alert: AlertService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTickets(1);
  }

  loadTickets(page: number): void {
    this.page = page;
    this.ticketService.pageIndex = page - 1;
    const sub = this.ticketService
      .fetchTickets(this.filterStatus || undefined)
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: () =>
          this.alert.error(
            this.t('TICKETS.MESSAGES.LOAD_ERROR_TITLE'),
            this.t('TICKETS.MESSAGES.LOAD_ERROR_TEXT'),
          ),
      });
    this.subscriptions.add(sub);
  }

  applyFilters(): void {
    this.loadTickets(1);
  }

  openTicketModal(
    modal: TemplateRef<any>,
    ticket: Ticket,
    tickets: Ticket[] = [ticket],
  ): void {
    this.selectedTicket = ticket;
    this.selectedTickets = tickets.length ? tickets : [ticket];
    this.modalService.open(modal, { size: 'lg' });
  }

  async confirmTicket(ticket: Ticket): Promise<void> {
    if (!ticket || ticket.status !== TicketStatus.PENDING) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CONFIRM_TEXT'),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .confirmTicket(ticket.id)
      .pipe(
        finalize(() => {
          this.statusUpdating[ticket.id] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: async (updatedTicket) => {
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS'));
          await this.printTicket(updatedTicket?.id || ticket.id);
        },
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async cancelTicket(ticket: Ticket): Promise<void> {
    if (!ticket || ticket.status === TicketStatus.CANCELLED) return;
    if (ticket.orderId?.trim() && this.isActiveOrderTicket(ticket)) {
      await this.cancelOrderPassenger(ticket.orderId, ticket);
      return;
    }
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CANCEL_TEXT'),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .cancelTicket(ticket.id)
      .pipe(
        finalize(() => {
          this.statusUpdating[ticket.id] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () =>
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async sendEmail(ticket: Ticket): Promise<void> {
    if (!ticket) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TEXT', {
        email:
          this.getTicketUserEmail(ticket) || this.getTicketUserName(ticket),
      }),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.emailSending[ticket.id] = true;
    const sub = this.ticketService
      .sendEmail(ticket.id)
      .pipe(
        finalize(() => {
          this.emailSending[ticket.id] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () =>
          this.alert.success(this.t('TICKETS.MESSAGES.EMAIL_SUCCESS_TITLE')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.EMAIL_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  trackTicket(_: number, ticket: Ticket): string {
    return ticket?.id;
  }

  trackDisplayRow(_: number, row: DisplayRow): string {
    return row.type === 'order'
      ? `order:${row.orderId}`
      : `ticket:${row.ticket?.id}`;
  }

  /** Group tickets into display rows: standalone tickets + collapsed order rows. */
  buildDisplayRows(tickets: Ticket[]): DisplayRow[] {
    const orderMap = new Map<string, Ticket[]>();
    const standaloneTickets: Ticket[] = [];

    for (const ticket of tickets) {
      const orderId = ticket.orderId?.trim();
      if (orderId && this.isActiveOrderTicket(ticket)) {
        const list = orderMap.get(orderId) || [];
        list.push(ticket);
        orderMap.set(orderId, list);
        continue;
      }

      standaloneTickets.push(ticket);
    }

    const rows: DisplayRow[] = standaloneTickets.map((ticket) => ({
      type: 'ticket',
      ticket,
    }));

    for (const [orderId, orderTickets] of orderMap) {
      const contactTicket = this.resolveOrderContactTicket(orderTickets);
      const totalPrice = orderTickets.reduce(
        (s, t) => s + (t.appliedPrice || 0),
        0,
      );
      rows.push({
        type: 'order',
        orderId,
        tickets: orderTickets,
        contactTicket,
        passengerCount: orderTickets.length,
        totalPrice,
        currency: contactTicket?.currency || orderTickets[0]?.currency,
        status: this.resolveOrderStatus(orderTickets),
      });
    }

    return rows.sort(
      (left, right) => this.getRowTimestamp(right) - this.getRowTimestamp(left),
    );
  }

  isOrderRow(row: DisplayRow): boolean {
    return row.type === 'order';
  }

  async confirmOrder(row: DisplayRow): Promise<void> {
    if (
      row.type !== 'order' ||
      !row.orderId ||
      row.status !== TicketStatus.PENDING
    )
      return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CONFIRM_ORDER_TEXT', {
        count: row.passengerCount,
      }),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[row.orderId] = true;
    const sub = this.bookingService
      .confirmOrder(row.orderId)
      .pipe(
        finalize(() => {
          this.statusUpdating[row.orderId!] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS'));
          void this.printOrder(row.orderId!, row.tickets || []);
          this.loadTickets(this.page);
        },
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async cancelOrder(row: DisplayRow): Promise<void> {
    if (row.type !== 'order' || !row.orderId) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CANCEL_ORDER_TEXT', {
        count: row.passengerCount,
      }),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[row.orderId] = true;
    const sub = this.bookingService
      .cancelOrder(row.orderId)
      .pipe(
        finalize(() => {
          this.statusUpdating[row.orderId!] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS'));
          this.loadTickets(this.page);
        },
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async printTicket(ticketId: string): Promise<void> {
    if (!ticketId || this.printing[ticketId]) {
      return;
    }

    this.printing[ticketId] = true;
    this.cdr.markForCheck();

    try {
      await this.ticketPrintService.printTicket(ticketId);
    } catch {
      this.alert.error(this.t('TICKETS.MESSAGES.PRINT_ERROR'));
    } finally {
      this.printing[ticketId] = false;
      this.cdr.markForCheck();
    }
  }

  async printOrder(orderId: string, tickets: Ticket[] = []): Promise<void> {
    if (!orderId || this.printing[orderId]) {
      return;
    }

    this.printing[orderId] = true;
    this.cdr.markForCheck();

    try {
      await this.ticketPrintService.printOrder(
        orderId,
        tickets.map((ticket) => ticket.id),
      );
    } catch {
      this.alert.error(this.t('TICKETS.MESSAGES.PRINT_ERROR'));
    } finally {
      this.printing[orderId] = false;
      this.cdr.markForCheck();
    }
  }

  async cancelOrderPassenger(orderId: string, ticket: Ticket): Promise<void> {
    if (!orderId || !ticket || !this.isActiveOrderTicket(ticket)) return;

    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CANCEL_PASSENGER_TEXT', {
        passenger: this.getTicketPassengerName(ticket),
      }),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;

    this.statusUpdating[ticket.id] = true;
    const sub = this.bookingService
      .cancelOrderPassenger(orderId, ticket.id)
      .pipe(
        finalize(() => {
          this.statusUpdating[ticket.id] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.syncSelectedOrderAfterPassengerCancel(orderId, ticket.id);
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS'));
          this.loadTickets(this.page);
        },
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async sendOrderEmail(row: DisplayRow): Promise<void> {
    if (row.type !== 'order' || !row.orderId) return;
    const contactName = this.getTicketUserName(row.contactTicket!);
    const contactEmail = this.getTicketUserEmail(row.contactTicket!);
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.EMAIL_ORDER_CONFIRM_TEXT', {
        email: contactEmail || contactName,
      }),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;
    this.emailSending[row.orderId] = true;
    const sub = this.ticketService
      .sendOrderEmail(row.orderId)
      .pipe(
        finalize(() => {
          this.emailSending[row.orderId!] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () =>
          this.alert.success(this.t('TICKETS.MESSAGES.EMAIL_SUCCESS_TITLE')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.EMAIL_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  getTicketUserName(ticket: Ticket): string {
    return this.getTicketPassengerName(ticket);
  }

  getTicketPassengerName(ticket: Ticket): string {
    const registeredName = ticket.user?.name?.trim();
    if (registeredName) {
      return registeredName;
    }

    const guestName = [ticket.guestFirstName, ticket.guestLastName]
      .filter((value): value is string => !!value && !!value.trim())
      .join(' ')
      .trim();
    if (guestName) {
      return guestName;
    }

    return ticket.passengerId || ticket.user?.id || ticket.id;
  }

  getTicketUserEmail(ticket: Ticket): string | null {
    return ticket.user?.email || null;
  }

  getTicketUserPhone(ticket: Ticket): string | null {
    const countryCode = ticket.user?.phone?.countryCode;
    const number = ticket.user?.phone?.number;

    if (!countryCode && !number) {
      return null;
    }

    if (!countryCode) {
      return number || null;
    }

    return `+${countryCode} ${number || ''}`.trim();
  }

  getTicketUserPictureUrl(ticket: Ticket): string | null {
    const baseUrl = ticket.user?.picture?.baseUrl;
    const path = ticket.user?.picture?.path;

    if (!baseUrl || !path) {
      return null;
    }

    return `${baseUrl}/${path}`;
  }

  getTicketUserInitial(ticket: Ticket): string {
    return this.getTicketUserName(ticket).charAt(0).toUpperCase();
  }

  canCancelPassenger(ticket: Ticket): boolean {
    return !!ticket.orderId?.trim() && this.isActiveOrderTicket(ticket);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private resolveOrderContactTicket(orderTickets: Ticket[]): Ticket {
    return (
      orderTickets.find((ticket) => !!ticket.passengerId) ||
      orderTickets.find(
        (ticket) =>
          !!ticket.user?.email ||
          !!ticket.user?.phone?.number ||
          !!ticket.user?.name,
      ) ||
      orderTickets[0]
    );
  }

  private resolveOrderStatus(orderTickets: Ticket[]): TicketStatus {
    return orderTickets.some((ticket) => ticket.status === TicketStatus.PENDING)
      ? TicketStatus.PENDING
      : TicketStatus.CONFIRMED;
  }

  private isActiveOrderTicket(ticket: Ticket): boolean {
    return (
      ticket.status === TicketStatus.PENDING ||
      ticket.status === TicketStatus.CONFIRMED
    );
  }

  private syncSelectedOrderAfterPassengerCancel(
    orderId: string,
    cancelledTicketId: string,
  ): void {
    if (this.selectedTicket?.orderId !== orderId) {
      return;
    }

    const remainingTickets = this.selectedTickets.filter(
      (ticket) => ticket.id !== cancelledTicketId,
    );

    if (!remainingTickets.length) {
      this.selectedTicket = null;
      this.selectedTickets = [];
      this.modalService.dismissAll();
      return;
    }

    this.selectedTickets = remainingTickets;
    if (this.selectedTicket?.id === cancelledTicketId) {
      this.selectedTicket = this.resolveOrderContactTicket(remainingTickets);
    }
  }

  private getRowTimestamp(row: DisplayRow): number {
    if (row.type === 'order') {
      return Math.max(
        ...(row.tickets || []).map((ticket) => this.getTicketTimestamp(ticket)),
        0,
      );
    }

    return row.ticket ? this.getTicketTimestamp(row.ticket) : 0;
  }

  private getTicketTimestamp(ticket: Ticket): number {
    const timestamp = ticket.createdAt ? Date.parse(ticket.createdAt) : NaN;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}

export interface DisplayRow {
  type: 'ticket' | 'order';
  ticket?: Ticket;
  orderId?: string;
  tickets?: Ticket[];
  contactTicket?: Ticket;
  passengerCount?: number;
  totalPrice?: number;
  currency?: string;
  status?: TicketStatus;
}
