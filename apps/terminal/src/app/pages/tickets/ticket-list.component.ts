import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import {
  NgbDropdownModule,
  NgbModal,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AlertService } from '../../core/services/alert.service';
import { Ticket, TicketStatus } from '../../core/models/ticket.model';
import { TicketService } from './ticket.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.scss'],
  imports: [CommonModule, NgbDropdownModule, NgbTooltipModule, TranslateModule],
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets$ = this.ticketService.tickets$;
  loading$ = this.ticketService.loading$;

  statusOptions: Array<{ value: TicketStatus; labelKey: string }> = [
    { value: TicketStatus.BOOKED, labelKey: 'TICKETS.STATUS.BOOKED' },
    { value: TicketStatus.PAID, labelKey: 'TICKETS.STATUS.PAID' },
    { value: TicketStatus.CANCELLED, labelKey: 'TICKETS.STATUS.CANCELLED' },
  ];

  statusLabelMap: Record<TicketStatus, string> = {
    [TicketStatus.BOOKED]: 'TICKETS.STATUS.BOOKED',
    [TicketStatus.PAID]: 'TICKETS.STATUS.PAID',
    [TicketStatus.CANCELLED]: 'TICKETS.STATUS.CANCELLED',
    [TicketStatus.EXPIRED]: 'TICKETS.STATUS.EXPIRED',
  };

  badgeClass: Record<TicketStatus, string> = {
    [TicketStatus.BOOKED]: 'badge-light-primary',
    [TicketStatus.PAID]: 'badge-light-success',
    [TicketStatus.CANCELLED]: 'badge-light-danger',
    [TicketStatus.EXPIRED]: 'badge-light-warning',
  };

  selectedTicket: Ticket | null = null;
  private subscriptions = new Subscription();
  statusUpdating: Record<string, boolean> = {};
  emailSending: Record<string, boolean> = {};

  constructor(
    private ticketService: TicketService,
    private modalService: NgbModal,
    private alert: AlertService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    const sub = this.ticketService.fetchTickets().subscribe({
      error: () =>
        this.alert.error(
          this.t('TICKETS.MESSAGES.LOAD_ERROR_TITLE'),
          this.t('TICKETS.MESSAGES.LOAD_ERROR_TEXT')
        ),
    });
    this.subscriptions.add(sub);
  }

  openTicketModal(modal: TemplateRef<any>, ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.modalService.open(modal, { size: 'lg' });
  }

  async changeStatus(ticket: Ticket, nextStatus: TicketStatus): Promise<void> {
    if (!ticket || ticket.status === nextStatus) {
      return;
    }
    const statusLabel = this.t(this.statusLabelMap[nextStatus] || nextStatus);
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TEXT', { status: statusLabel }),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) {
      return;
    }
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .updateStatus(ticket.id, nextStatus)
      .pipe(finalize(() => (this.statusUpdating[ticket.id] = false)))
      .subscribe({
        next: () =>
          this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async sendEmail(ticket: Ticket): Promise<void> {
    if (!ticket) {
      return;
    }
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TEXT', {
        email: ticket.user?.email || '—',
      }),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) {
      return;
    }
    this.emailSending[ticket.id] = true;
    const sub = this.ticketService
      .sendEmail(ticket.id, ticket.user?.email || undefined)
      .pipe(finalize(() => (this.emailSending[ticket.id] = false)))
      .subscribe({
        next: (response) => {
          this.emailSending[ticket.id] = false;
          this.alert.success(
            this.t('TICKETS.MESSAGES.EMAIL_SUCCESS_TITLE'),
            response?.email
              ? this.t('TICKETS.MESSAGES.EMAIL_SUCCESS_TEXT', {
                  email: response.email,
                })
              : undefined
          );
        },
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.EMAIL_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  trackTicket(_: number, ticket: Ticket): string {
    return ticket?.id;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getPassengerName(ticket: Ticket): string {
    const first = ticket?.user?.firstName?.trim() ?? '';
    const last = ticket?.user?.lastName?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full || this.t('TICKETS.DEFAULT_PASSENGER');
  }

  seatList(ticket: Ticket): string {
    return (ticket?.seats || [])
      .map((seat) => seat.label || `${seat.row}-${seat.col}`)
      .join(', ');
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
