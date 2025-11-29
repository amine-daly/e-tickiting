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

@Component({
  standalone: true,
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.scss'],
  imports: [CommonModule, NgbDropdownModule, NgbTooltipModule],
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets$ = this.ticketService.tickets$;
  loading$ = this.ticketService.loading$;

  statusOptions: Array<{ value: TicketStatus; label: string }> = [
    { value: TicketStatus.BOOKED, label: 'Booked' },
    { value: TicketStatus.PAID, label: 'Paid' },
    { value: TicketStatus.CANCELLED, label: 'Cancelled' },
  ];

  statusLabelMap: Record<TicketStatus, string> = {
    [TicketStatus.BOOKED]: 'Réservé',
    [TicketStatus.PAID]: 'Payé',
    [TicketStatus.CANCELLED]: 'Annulé',
    [TicketStatus.EXPIRED]: 'Expiré',
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
    private alert: AlertService
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    const sub = this.ticketService.fetchTickets().subscribe({
      error: () =>
        this.alert.error(
          'Impossible de charger les tickets',
          'Réessayez ultérieurement'
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
    const result = await this.alert.confirm(
      'Confirmer le changement de statut',
      `Voulez-vous vraiment changer le statut du ticket à « ${
        this.statusLabelMap[nextStatus] || nextStatus
      } » ?`,
      'Oui, changer',
      'Annuler'
    );
    if (!result.isConfirmed) {
      return;
    }
    this.statusUpdating[ticket.id] = true;
    const sub = this.ticketService
      .updateStatus(ticket.id, nextStatus)
      .pipe(finalize(() => (this.statusUpdating[ticket.id] = false)))
      .subscribe({
        next: () => this.alert.success('Statut mis à jour'),
        error: () => this.alert.error('Impossible de mettre à jour le statut'),
      });
    this.subscriptions.add(sub);
  }

  async sendEmail(ticket: Ticket): Promise<void> {
    if (!ticket) {
      return;
    }
    const result = await this.alert.confirm(
      'Confirmer l’envoi',
      `Voulez-vous envoyer le ticket à « ${ticket.user?.email || '—'} » ?`,
      'Oui, envoyer',
      'Annuler'
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
            'Email envoyé',
            response?.email ? `Destinataire : ${response.email}` : undefined
          );
        },
        error: () => this.alert.error("L'envoi de l'email a échoué"),
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
    return full || 'Client';
  }

  seatList(ticket: Ticket): string {
    return (ticket?.seats || [])
      .map((seat) => seat.label || `${seat.row}-${seat.col}`)
      .join(', ');
  }
}
