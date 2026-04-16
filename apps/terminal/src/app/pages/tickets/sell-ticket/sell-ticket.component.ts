import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Subject,
  Subscription,
  Observable,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
} from 'rxjs';

import { AlertService } from '../../../core/services/alert.service';
import {
  BookingService,
  BookingRequest,
  BookingResponse,
} from '../../../core/services/booking.service';
import { UserType } from '../../../core/models/user-type';
import {
  TripType,
  PickupPointType,
  DropoffPointType,
} from '../../../core/models/trip.model';
import { CustomersService } from '../../customers/customers.service';
import { TripService } from '../../trip/trip.service';

@Component({
  standalone: true,
  selector: 'app-sell-ticket',
  templateUrl: './sell-ticket.component.html',
  styleUrls: ['./sell-ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    TranslateModule,
  ],
})
export class SellTicketComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();
  private customerSearch$ = new Subject<string>();

  step = 1; // 1=customer, 2=trip, 3=review

  // Step 1 — Customer
  customerQuery = '';
  customers: UserType[] = [];
  customerLoading = false;
  selectedCustomer: UserType | null = null;
  private customerPage = 0;
  private customerIsLast = false;
  private readonly customerPageSize = 20;

  // Step 2 — Trip
  trips: TripType[] = [];
  tripsLoading = false;
  selectedTrip: TripType | null = null;

  // Step 3 — Review & Book
  activePickups: PickupPointType[] = [];
  activeDropoffs: DropoffPointType[] = [];
  selectedPickupId: string | null = null;
  selectedDropoffId: string | null = null;
  displayPrice = 0;
  currency = '';
  booking = false;
  booked = false;
  bookingResult: BookingResponse | null = null;

  constructor(
    private bookingService: BookingService,
    private customersService: CustomersService,
    private tripService: TripService,
    private alert: AlertService,
    private translate: TranslateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const sub = this.customerSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.customerQuery = (q || '').trim();
          return this.fetchCustomers(true);
        }),
      )
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => this.cdr.markForCheck(),
      });
    this.subscriptions.add(sub);

    const initialLoadSub = this.fetchCustomers(true).subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.cdr.markForCheck(),
    });
    this.subscriptions.add(initialLoadSub);
  }

  // ─── Step 1: Customer ───
  onCustomerSearch(term: string): void {
    this.customerSearch$.next(term);
  }

  selectCustomer(customer: UserType): void {
    this.selectedCustomer = customer;
  }

  loadMoreCustomers(): void {
    if (this.customerLoading || this.customerIsLast) {
      return;
    }

    const sub = this.fetchCustomers(false).subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.cdr.markForCheck(),
    });
    this.subscriptions.add(sub);
  }

  goToStep2(): void {
    if (!this.selectedCustomer) return;
    this.step = 2;
    this.loadTrips();
  }

  // ─── Step 2: Trip ───
  private loadTrips(): void {
    this.tripsLoading = true;
    this.cdr.markForCheck();
    const sub = this.tripService.list({ status: 'ACTIVE' as any }).subscribe({
      next: (trips) => {
        this.trips = trips;
        this.tripsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.tripsLoading = false;
        this.cdr.markForCheck();
      },
    });
    this.subscriptions.add(sub);
  }

  selectTrip(trip: TripType): void {
    this.selectedTrip = trip;
    this.activePickups = (trip.pickupPoints || []).filter((p) => p.active);
    this.activeDropoffs = (trip.dropoffPoints || []).filter((p) => p.active);
    this.selectedPickupId = this.activePickups[0]?.pointId || null;
    this.selectedDropoffId = this.activeDropoffs[0]?.pointId || null;
    this.computePrice();
  }

  goToStep3(): void {
    if (!this.selectedTrip) return;
    this.step = 3;
  }

  // ─── Step 3: Review & Book ───
  onPickupChange(): void {
    this.computePrice();
  }

  onDropoffChange(): void {
    this.computePrice();
  }

  private getSelectedPickupPlaceId(): string | null {
    if (!this.selectedPickupId || !this.selectedTrip) return null;
    const pp = (this.selectedTrip.pickupPoints || []).find(
      (p) => p.pointId === this.selectedPickupId,
    );
    return pp?.placeId || null;
  }

  private getSelectedDropoffPlaceId(): string | null {
    if (!this.selectedDropoffId || !this.selectedTrip) return null;
    const dp = (this.selectedTrip.dropoffPoints || []).find(
      (p) => p.pointId === this.selectedDropoffId,
    );
    return dp?.placeId || null;
  }

  private computePrice(): void {
    if (!this.selectedTrip) return;
    this.currency = this.selectedTrip.currency?.code || '';

    const fromPlaceId = this.getSelectedPickupPlaceId();
    const toPlaceId = this.getSelectedDropoffPlaceId();
    if (!fromPlaceId || !toPlaceId) return;

    const now = new Date();
    const express = (this.selectedTrip.expressFares || []).find(
      (f) =>
        f.fromPlaceId === fromPlaceId &&
        f.toPlaceId === toPlaceId &&
        f.active &&
        (!f.validFrom || now >= new Date(f.validFrom)) &&
        (!f.validUntil || now <= new Date(f.validUntil)),
    );
    if (express) {
      this.displayPrice = express.price;
    } else {
      const chain = this.resolveDisplaySegments(fromPlaceId, toPlaceId);
      this.displayPrice = chain.reduce((s, seg) => s + (seg.basePrice || 0), 0);
    }
    this.cdr.markForCheck();
  }

  private resolveDisplaySegments(fromPlaceId: string, toPlaceId: string) {
    const segments = this.selectedTrip?.segments || [];
    const sorted = [...segments].sort((a, b) => a.sequence - b.sequence);
    const startIdx = sorted.findIndex((s) => s.fromPlaceId === fromPlaceId);
    if (startIdx === -1) return sorted;
    const chain: typeof sorted = [];
    for (let i = startIdx; i < sorted.length; i++) {
      chain.push(sorted[i]);
      if (sorted[i].toPlaceId === toPlaceId) return chain;
    }
    return sorted;
  }

  confirmBooking(): void {
    if (!this.selectedCustomer || !this.selectedTrip || this.booking) return;

    const fromPlaceId = this.getSelectedPickupPlaceId() || '';
    const toPlaceId = this.getSelectedDropoffPlaceId() || '';

    this.booking = true;
    this.cdr.markForCheck();

    const request: BookingRequest = {
      tripId: this.selectedTrip.id,
      fromPlaceId,
      toPlaceId,
      pickupPointId: this.selectedPickupId || '',
      dropoffPointId: this.selectedDropoffId || '',
      passengerId: this.selectedCustomer.id,
      idempotencyKey: crypto.randomUUID(),
    };

    const sub = this.bookingService.createBooking(request).subscribe({
      next: (res) => {
        this.booking = false;
        this.booked = true;
        this.bookingResult = res;
        this.cdr.markForCheck();
        this.alert.success(this.t('TICKETS.SELL.SUCCESS'));
      },
      error: () => {
        this.booking = false;
        this.cdr.markForCheck();
        this.alert.error(this.t('TICKETS.SELL.ERROR'));
      },
    });
    this.subscriptions.add(sub);
  }

  goToTickets(): void {
    this.router.navigate(['/tickets']);
  }

  goBack(): void {
    if (this.step > 1) {
      this.step--;
      this.cdr.markForCheck();
    }
  }

  getStopCity(placeId: string): string {
    if (!placeId || !this.selectedTrip) return placeId;
    const stops = this.selectedTrip.stopSchedule || [];
    const stop = stops.find((s) => s.placeId === placeId);
    return stop?.place?.city || placeId;
  }

  private fetchCustomers(reset: boolean): Observable<UserType[]> {
    if (reset) {
      this.customerPage = 0;
      this.customerIsLast = false;
    }

    this.customerLoading = true;
    this.cdr.markForCheck();

    const companyId = localStorage.getItem('companyId') || undefined;
    const page = this.customerPage;
    const request$ =
      this.customerQuery.length >= 2
        ? this.customersService.searchCustomers(
            this.customerQuery,
            companyId,
            page,
            this.customerPageSize,
          )
        : this.customersService.getCustomersByCompany(
            companyId,
            page,
            this.customerPageSize,
          );

    return request$.pipe(
      map((response) => {
        const incoming = response?.objects || [];
        this.customerPage = page + 1;
        this.customerIsLast = response?.isLast ?? true;
        this.customers = reset
          ? incoming
          : this.mergeCustomers(this.customers, incoming);
        return this.customers;
      }),
      finalize(() => {
        this.customerLoading = false;
        this.cdr.markForCheck();
      }),
    );
  }

  private mergeCustomers(
    existing: UserType[],
    incoming: UserType[],
  ): UserType[] {
    const merged = new Map<string, UserType>();

    [...existing, ...incoming].forEach((customer) => {
      if (customer?.id) {
        merged.set(customer.id, customer);
      }
    });

    return Array.from(merged.values());
  }

  // ─── ROUTE PREVIEW ─────────────────────────────────────
  routePreview(trip: TripType): string {
    if (!trip?.stopSchedule?.length) return '-';
    const stops = [...trip.stopSchedule].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const first = stops[0]?.place?.city || stops[0]?.placeId || '-';
    const last =
      stops[stops.length - 1]?.place?.city ||
      stops[stops.length - 1]?.placeId ||
      '-';
    if (first === last) return first;
    return `${first} → ${last}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
