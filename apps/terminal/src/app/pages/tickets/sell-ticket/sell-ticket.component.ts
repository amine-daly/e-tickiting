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
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
} from 'rxjs';

import { AlertService } from '../../../core/services/alert.service';
import {
  BookingService,
  BookingRequest,
  BookingResponse,
  UserSearchResult,
} from '../../../core/services/booking.service';
import { TripService } from '../../trip/trip.service';
import { PlacesService } from '../../places/places.service';
import {
  TripType,
  PickupPointType,
  DropoffPointType,
  SegmentType,
} from '../../../core/models/trip.model';

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
  customers: UserSearchResult[] = [];
  customerLoading = false;
  selectedCustomer: UserSearchResult | null = null;

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
    private tripService: TripService,
    private placesService: PlacesService,
    private alert: AlertService,
    private translate: TranslateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Debounced customer search
    const sub = this.customerSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q || q.length < 2) {
            this.customers = [];
            this.cdr.markForCheck();
            return of(null);
          }
          this.customerLoading = true;
          this.cdr.markForCheck();
          return this.bookingService.searchUsers(q);
        }),
      )
      .subscribe({
        next: (res) => {
          this.customerLoading = false;
          if (res) this.customers = res.objects || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.customerLoading = false;
          this.cdr.markForCheck();
        },
      });
    this.subscriptions.add(sub);
  }

  // ─── Step 1: Customer ───
  onCustomerSearch(term: string): void {
    this.customerSearch$.next(term);
  }

  selectCustomer(customer: UserSearchResult): void {
    this.selectedCustomer = customer;
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
  private computePrice(): void {
    if (!this.selectedTrip) return;
    const stops = this.selectedTrip.stopSchedule || [];
    const fromPlaceId = stops[0]?.placeId;
    const toPlaceId = stops[stops.length - 1]?.placeId;
    this.currency = this.selectedTrip.currency?.code || '';

    const express = (this.selectedTrip.expressFares || []).find(
      (f) =>
        f.fromPlaceId === fromPlaceId && f.toPlaceId === toPlaceId && f.active,
    );
    if (express) {
      this.displayPrice = express.price;
    } else {
      this.displayPrice = (this.selectedTrip.segments || []).reduce(
        (s, seg) => s + (seg.basePrice || 0),
        0,
      );
    }
    this.cdr.markForCheck();
  }

  confirmBooking(): void {
    if (!this.selectedCustomer || !this.selectedTrip || this.booking) return;

    const stops = this.selectedTrip.stopSchedule || [];
    const fromPlaceId = stops[0]?.placeId || '';
    const toPlaceId = stops[stops.length - 1]?.placeId || '';

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
    return placeId; // Places resolution could be added here
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
