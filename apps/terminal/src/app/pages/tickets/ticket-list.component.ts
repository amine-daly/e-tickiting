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
import { finalize } from 'rxjs/operators';

import { AlertService } from '../../core/services/alert.service';
import { Ticket, TicketStatus } from '../../core/models/ticket.model';
import { TicketService } from './ticket.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { FormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';

@Component({
  standalone: true,
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    TranslateModule,
    PaginationComponent,
    NgSelectComponent,
  ],
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets$ = this.ticketService.tickets$;
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
  private subscriptions = new Subscription();
  statusUpdating: Record<string, boolean> = {};
  emailSending: Record<string, boolean> = {};

  constructor(
    private ticketService: TicketService,
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
            this.t('TICKETS.MESSAGES.LOAD_ERROR_TEXT')
          ),
      });
    this.subscriptions.add(sub);
  }

  applyFilters(): void {
    this.loadTickets(1);
  }

  openTicketModal(modal: TemplateRef<any>, ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.modalService.open(modal, { size: 'lg' });
  }

  async confirmTicket(ticket: Ticket): Promise<void> {
    if (!ticket || ticket.status !== TicketStatus.PENDING) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CONFIRM_TEXT'),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .confirmTicket(ticket.id)
      .pipe(finalize(() => { this.statusUpdating[ticket.id] = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async cancelTicket(ticket: Ticket): Promise<void> {
    if (!ticket || ticket.status === TicketStatus.CANCELLED) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.CANCEL_TEXT'),
      this.t('TICKETS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) return;
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .cancelTicket(ticket.id)
      .pipe(finalize(() => { this.statusUpdating[ticket.id] = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => this.alert.success(this.t('TICKETS.MESSAGES.STATUS_SUCCESS')),
        error: () => this.alert.error(this.t('TICKETS.MESSAGES.STATUS_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  async sendEmail(ticket: Ticket): Promise<void> {
    if (!ticket) return;
    const result = await this.alert.confirm(
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TITLE'),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_TEXT'),
      this.t('TICKETS.MESSAGES.EMAIL_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) return;
    this.emailSending[ticket.id] = true;
    const sub = this.ticketService
      .sendEmail(ticket.id)
      .pipe(finalize(() => { this.emailSending[ticket.id] = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => this.alert.success(this.t('TICKETS.MESSAGES.EMAIL_SUCCESS_TITLE')),
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
