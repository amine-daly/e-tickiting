import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { v4 as uuid } from 'uuid';
import {
  Subject,
  Subscription,
  Observable,
  debounceTime,
  distinctUntilChanged,
  finalize,
  interval,
  map,
  switchMap,
  take,
  of,
} from 'rxjs';

import { AlertService } from '../../../core/services/alert.service';
import {
  BookingService,
  BookingCustomerInput,
  BookingRequest,
  BookingResponse,
  GroupBookingRequest,
  GroupBookingResponse,
  GroupSeatAssignment,
} from '../../../core/services/booking.service';
import { TicketPrintService } from '../../../core/services/ticket-print.service';
import { PhoneType, UserType } from '../../../core/models/user-type';
import {
  TripType,
  PickupPointType,
  DropoffPointType,
  TripRouteAvailabilityType,
  TripStatusEnum,
} from '../../../core/models/trip.model';
import {
  LayoutTemplate,
  LayoutElementType,
} from '../../../core/models/bus.model';
import { CustomersService } from '../../customers/customers.service';
import { TripService } from '../../trip/trip.service';
import { BusService } from '../../buses/bus.service';

interface SellPassenger {
  customer?: UserType;
  firstName?: string;
  lastName?: string;
  seatNo?: string;
  isGuest: boolean;
}

interface QuickCustomerDraft {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
}

@Component({
  standalone: true,
  selector: 'app-sell-ticket',
  templateUrl: './sell-ticket.component.html',
  styleUrls: ['./sell-ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CommonModule,
    TranslateModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
  ],
})
export class SellTicketComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();
  readonly customerSearch$ = new Subject<string>();
  private seatPollingSubscription: Subscription | null = null;
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  step = 1; // 1=trip, 2=passengers, 3=seat, 4=review

  // Step 1 — Passengers
  customerQuery = '';
  customers: UserType[] = [];
  selectedCustomer: UserType | null = null;
  customerLoading = false;
  passengers: SellPassenger[] = [];
  quickCustomer: QuickCustomerDraft = this.createQuickCustomerDraft();
  private customerPage = 0;
  private customerIsLast = false;
  private readonly customerPageSize = 20;

  // Step 2 — Trip
  trips: TripType[] = [];
  tripsLoading = false;
  selectedTrip: TripType | null = null;

  // Step 3 — Seat Selection (multi-passenger)
  busLayout: LayoutTemplate | null = null;
  layoutLoading = false;
  currentSeatAssignIndex = 0; // which passenger we're assigning next
  occupiedSeats: string[] = [];
  readonly LayoutElementType = LayoutElementType;

  // Step 4 — Review & Book
  activePickups: PickupPointType[] = [];
  activeDropoffs: DropoffPointType[] = [];
  selectedPickupId: string | null = null;
  selectedDropoffId: string | null = null;
  displayPrice = 0;
  currency = '';
  routeAvailability: TripRouteAvailabilityType | null = null;
  booking = false;
  booked = false;
  bookingResult: BookingResponse | null = null;
  groupBookingResult: GroupBookingResponse | null = null;
  hasVisualLayout = false;

  constructor(
    private router: Router,
    private busService: BusService,
    private cdr: ChangeDetectorRef,
    private tripService: TripService,
    private alertService: AlertService,
    private translate: TranslateService,
    private bookingService: BookingService,
    private ticketPrintService: TicketPrintService,
    private customersService: CustomersService,
  ) {}

  ngOnInit(): void {
    // Load trips immediately for Step 1
    this.loadTrips();

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
  }

  // ─── Step 1: Trip ───
  onCustomerSearch(term: string): void {
    this.customerSearch$.next(term);
  }

  selectTrip(trip: TripType): void {
    this.selectedTrip = trip;
    this.activePickups = (trip.pickupPoints || []).filter((p) => p.active);
    this.activeDropoffs = (trip.dropoffPoints || []).filter((p) => p.active);
    this.selectedPickupId = this.activePickups[0]?.pointId || null;
    this.selectedDropoffId = this.activeDropoffs[0]?.pointId || null;
    this.refreshRouteAvailability(true);
  }

  // ─── Step 2: Passengers ───
  addPassenger(customer: UserType): void {
    if (!customer) return;
    this.selectedCustomer = customer;
    this.quickCustomer = this.createQuickCustomerDraft();

    // Only allow one contact customer (first passenger)
    if (
      this.passengers.length > 0 &&
      this.passengers[0].customer?.id === customer.id
    )
      return;
    if (this.passengers.length === 0) {
      this.passengers.push({ customer, isGuest: false });
    } else {
      // Replace contact customer
      this.passengers[0] = {
        customer,
        isGuest: false,
        seatNo: this.passengers[0].seatNo,
      };
    }
    this.cdr.markForCheck();
  }

  clearSelectedCustomer(): void {
    this.selectedCustomer = null;

    if (!this.passengers.length) {
      this.cdr.markForCheck();
      return;
    }

    if (!this.passengers[0].isGuest) {
      const seatNo = this.passengers[0].seatNo;
      if (this.hasQuickCustomerDraft) {
        this.passengers[0] = this.buildQuickCustomerPassenger(seatNo);
      } else {
        this.passengers.splice(0, 1);
      }
    }

    this.cdr.markForCheck();
  }

  useQuickCustomerEntry(): void {
    this.selectedCustomer = null;
    this.syncQuickCustomerPassenger(true);
    this.cdr.markForCheck();
  }

  onQuickCustomerChanged(): void {
    if (this.selectedCustomer) {
      this.selectedCustomer = null;
    }
    this.syncQuickCustomerPassenger();
    this.cdr.markForCheck();
  }

  addGuestPassenger(): void {
    if (!this.canAddGuestPassenger) {
      return;
    }
    this.passengers.push({ firstName: '', lastName: '', isGuest: true });
    this.cdr.markForCheck();
  }

  removePassenger(index: number): void {
    this.passengers.splice(index, 1);
    this.cdr.markForCheck();
  }

  /** First passenger is the contact customer. */
  get contactCustomer(): UserType | null {
    return this.passengers.length > 0 && this.passengers[0].customer
      ? this.passengers[0].customer
      : null;
  }

  get contactPassenger(): SellPassenger | null {
    return this.passengers.length > 0 ? this.passengers[0] : null;
  }

  get hasQuickCustomerDraft(): boolean {
    return [
      this.quickCustomer.firstName,
      this.quickCustomer.lastName,
      this.quickCustomer.email,
      this.quickCustomer.phoneNumber,
    ].some((value) => !!value?.trim());
  }

  get quickCustomerPhone(): PhoneType | null {
    const number = this.quickCustomer.phoneNumber.replace(/\s+/g, '').trim();
    const countryCode = this.quickCustomer.phoneCountryCode.trim();

    if (!countryCode && !number) {
      return null;
    }
    if (!countryCode || !number) {
      return null;
    }

    return {
      countryCode,
      number,
    };
  }

  get quickCustomerEmail(): string | null {
    const email = this.quickCustomer.email.trim().toLowerCase();
    if (!email || !this.emailPattern.test(email)) {
      return null;
    }
    return email;
  }

  get quickCustomerContactValue(): string | null {
    return this.quickCustomerEmail || this.formatPhone(this.quickCustomerPhone);
  }

  get quickCustomerReady(): boolean {
    return (
      !!this.quickCustomer.firstName.trim() &&
      !!this.quickCustomer.lastName.trim() &&
      (!!this.quickCustomerEmail || !!this.quickCustomerPhone)
    );
  }

  get canAddGuestPassenger(): boolean {
    return (
      this.isContactReady &&
      (this.availableSeats === 0 ||
        this.passengers.length < this.availableSeats)
    );
  }

  get isGroupBooking(): boolean {
    return this.passengers.length > 1;
  }

  get routeBlockedByExpressSegmentRule(): boolean {
    return (
      !!this.routeAvailability?.requiresExpressSegment &&
      !this.routeAvailability?.sellable
    );
  }

  /** Number of available seats for the selected route segment chain. */
  get availableSeats(): number {
    return this.routeAvailability?.availableSeats || 0;
  }

  get isAvailableSeats(): boolean {
    // Only return true if availableSeats is greater than 0
    // AND we haven't reached the limit yet.
    return (
      this.availableSeats > 0 && this.passengers.length <= this.availableSeats
    );
  }

  /** Whether Step 1 (Trip + Pickup/Dropoff) can proceed to Step 2 */
  get canProceedStep1(): boolean {
    return (
      !!this.selectedTrip &&
      !!this.selectedPickupId &&
      !!this.selectedDropoffId &&
      this.availableSeats > 0
    );
  }

  /** Whether Step 2 (Passengers) can proceed to Step 3 */
  get canProceedStep2(): boolean {
    if (this.passengers.length === 0 || !this.isContactReady) {
      return false;
    }
    // All guest passengers must have names
    return (
      this.isAvailableSeats &&
      this.passengers.every(
        (p, index) =>
          index === 0 ||
          !p.isGuest ||
          (!!p.firstName?.trim() && !!p.lastName?.trim()),
      )
    );
  }

  get isContactReady(): boolean {
    const contactPassenger = this.contactPassenger;
    if (!contactPassenger || contactPassenger.isGuest) {
      return false;
    }
    if (contactPassenger.customer) {
      return true;
    }
    return this.quickCustomerReady;
  }

  /** Display name for a passenger entry. */
  passengerDisplayName(p: SellPassenger): string {
    if (p.customer)
      return `${p.customer.firstName || ''} ${p.customer.lastName || ''}`.trim();
    return `${p.firstName || ''} ${p.lastName || ''}`.trim() || '—';
  }

  passengerContactValue(p: SellPassenger, index: number): string | null {
    if (p.customer) {
      return p.customer.email || this.formatPhone(p.customer.phone);
    }
    if (index === 0) {
      return this.quickCustomerContactValue;
    }
    return null;
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
    if (!this.selectedTrip) return;
    // Load customers when entering the passengers step
    if (!this.customers.length) {
      const initialLoadSub = this.fetchCustomers(true).subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => this.cdr.markForCheck(),
      });
      this.subscriptions.add(initialLoadSub);
    }
    this.step = 2;
  }

  // ─── Trip loading ───
  private loadTrips(): void {
    this.cdr.markForCheck();
    const sub = this.tripService
      .tripList({ status: TripStatusEnum.ACTIVE })
      .subscribe({
        next: (trips) => {
          this.trips = trips;
          this.syncSelectedTrip(trips);
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

  private syncSelectedTrip(trips: TripType[]): void {
    if (!this.selectedTrip?.id) {
      return;
    }

    const refreshedTrip = trips.find(
      (trip) => trip.id === this.selectedTrip?.id,
    );
    if (!refreshedTrip) {
      this.selectedTrip = null;
      this.activePickups = [];
      this.activeDropoffs = [];
      this.selectedPickupId = null;
      this.selectedDropoffId = null;
      this.displayPrice = 0;
      this.routeAvailability = null;
      return;
    }

    this.selectedTrip = refreshedTrip;
    this.activePickups = (refreshedTrip.pickupPoints || []).filter(
      (point) => point.active,
    );
    this.activeDropoffs = (refreshedTrip.dropoffPoints || []).filter(
      (point) => point.active,
    );

    if (
      this.selectedPickupId &&
      !this.activePickups.some(
        (point) => point.pointId === this.selectedPickupId,
      )
    ) {
      this.selectedPickupId = this.activePickups[0]?.pointId || null;
    }
    if (
      this.selectedDropoffId &&
      !this.activeDropoffs.some(
        (point) => point.pointId === this.selectedDropoffId,
      )
    ) {
      this.selectedDropoffId = this.activeDropoffs[0]?.pointId || null;
    }

    this.refreshRouteAvailability();
  }

  goToStep3(): void {
    if (!this.canProceedStep2) return;
    if (!this.selectedTrip) return;

    if (!this.routeAvailability?.sellable) {
      this.alertService.error(
        this.t('TICKETS.SELL.ROUTE_REQUIRES_ACTIVE_EXPRESS_SEGMENT'),
      );
      return;
    }

    // Reset seat assignments for all passengers
    this.passengers.forEach((p) => (p.seatNo = undefined));
    this.currentSeatAssignIndex = 0;
    this.proceedToSeatOrReview();
  }

  /**
   * After booking hold is created, load bus layout for seat selection
   * or skip directly to review (step 4) if no layout.
   */
  private proceedToSeatOrReview(): void {
    this.stopSeatAvailabilityPolling();

    const busId = this.selectedTrip?.bus?.busId;
    if (!busId) {
      this.busLayout = null;
      this.step = 4;
      this.cdr.markForCheck();
      return;
    }

    this.layoutLoading = true;
    this.occupiedSeats = [];
    this.step = 3;
    this.cdr.markForCheck();

    const busSub = this.busService
      .getBusById(busId)
      .pipe(
        take(1),
        switchMap((bus) => {
          this.busLayout = bus?.layoutTemplate || null;
          this.layoutLoading = false;

          if (!this.busLayout) {
            this.step = 4;
          }
          this.hasVisualLayout = !!this.busLayout;
          this.startSeatAvailabilityPolling();
          return of(bus);
        }),
      )
      .subscribe({
        next: (bus) => {
          this.cdr.markForCheck();
        },
        error: () => {
          this.busLayout = null;
          this.layoutLoading = false;
          this.step = 4;
          this.cdr.markForCheck();
        },
      });
    this.subscriptions.add(busSub);
  }

  selectSeat(seatNo: string | null | undefined): void {
    if (!seatNo || this.isSeatOccupied(seatNo)) return;

    // Check if this seat is already assigned to a passenger in the group
    const alreadyIdx = this.passengers.findIndex((p) => p.seatNo === seatNo);
    if (alreadyIdx >= 0) {
      // Deselect it
      this.passengers[alreadyIdx].seatNo = undefined;
      // Reset current assign index to the first unassigned
      this.currentSeatAssignIndex = this.passengers.findIndex((p) => !p.seatNo);
      if (this.currentSeatAssignIndex === -1)
        this.currentSeatAssignIndex = this.passengers.length;
      this.cdr.markForCheck();
      return;
    }

    // Assign to current passenger
    if (this.currentSeatAssignIndex < this.passengers.length) {
      this.passengers[this.currentSeatAssignIndex].seatNo = seatNo;
      // Advance to next unassigned
      this.currentSeatAssignIndex = this.passengers.findIndex((p) => !p.seatNo);
      if (this.currentSeatAssignIndex === -1)
        this.currentSeatAssignIndex = this.passengers.length;
    }
    this.cdr.markForCheck();
  }

  isSeatOccupied(seatNo: string): boolean {
    return (
      this.occupiedSeats.includes(seatNo) && !this.isSeatSelectedByGroup(seatNo)
    );
  }

  /** Whether a seat is selected by any passenger in the current group. */
  isSeatSelectedByGroup(seatNo: string): boolean {
    return this.passengers.some((p) => p.seatNo === seatNo);
  }

  /** Get the passenger index who has this seat, or -1. */
  seatAssignedToIndex(seatNo: string): number {
    return this.passengers.findIndex((p) => p.seatNo === seatNo);
  }

  /** All passengers have seats assigned. */
  get allSeatsAssigned(): boolean {
    return this.passengers.every((p) => !!p.seatNo);
  }

  /** The currently-being-assigned passenger. */
  get currentAssignPassenger(): {
    customer?: UserType;
    firstName?: string;
    lastName?: string;
    seatNo?: string;
    isGuest: boolean;
  } | null {
    return this.currentSeatAssignIndex < this.passengers.length
      ? this.passengers[this.currentSeatAssignIndex]
      : null;
  }

  goToStep4(): void {
    if (this.hasVisualLayout && !this.allSeatsAssigned) return;
    if (this.passengers.length === 0 || !this.selectedTrip || this.booking) {
      return;
    }

    this.stopSeatAvailabilityPolling();
    this.step = 4;
    this.cdr.markForCheck();
  }

  // ─── Step 1: Pickup/Dropoff change ───
  onPickupChange(): void {
    this.refreshRouteAvailability(true);
  }

  onDropoffChange(): void {
    this.refreshRouteAvailability(true);
  }

  private trimPassengersToCapacity(): void {
    const cap = this.availableSeats;
    if (cap > 0 && this.passengers.length > cap) {
      const removed = this.passengers.length - cap;
      this.passengers.splice(cap);
      this.alertService.warning(
        this.t('TICKETS.SELL.PASSENGERS_TRIMMED', { count: removed }),
      );
    }
    this.cdr.markForCheck();
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

  private refreshRouteAvailability(trimPassengers = false): void {
    this.routeAvailability = null;
    this.displayPrice = 0;
    this.currency = this.selectedTrip?.currency?.code || '';

    if (!this.selectedTrip) {
      this.cdr.markForCheck();
      return;
    }

    const originPlaceId = this.getSelectedPickupPlaceId();
    const destinationPlaceId = this.getSelectedDropoffPlaceId();
    if (!originPlaceId || !destinationPlaceId) {
      this.cdr.markForCheck();
      return;
    }

    const sub = this.tripService
      .getRouteAvailability(
        this.selectedTrip.id,
        originPlaceId,
        destinationPlaceId,
      )
      .subscribe({
        next: (routeAvailability) => {
          this.routeAvailability = routeAvailability;
          this.displayPrice = routeAvailability?.displayPrice || 0;
          this.currency = routeAvailability?.currencyCode || this.currency;
          if (trimPassengers) {
            this.trimPassengersToCapacity();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.routeAvailability = null;
          this.displayPrice = 0;
          if (trimPassengers) {
            this.trimPassengersToCapacity();
          }
          this.cdr.markForCheck();
        },
      });
    this.subscriptions.add(sub);
  }

  confirmPayment(): void {
    if (this.booking || !this.selectedTrip) return;

    const originPlaceId = this.getSelectedPickupPlaceId() || '';
    const destinationPlaceId = this.getSelectedDropoffPlaceId() || '';
    this.booking = true;
    this.cdr.markForCheck();

    if (this.isGroupBooking) {
      const groupReq: GroupBookingRequest = {
        tripId: this.selectedTrip.id,
        originPlaceId,
        destinationPlaceId,
        pickupPointId: this.selectedPickupId || '',
        dropoffPointId: this.selectedDropoffId || '',
        contactCustomerId: this.contactCustomer?.id,
        contact: this.buildBookingContactInput(),
        idempotencyKey: uuid(),
        passengers: this.passengers.map((p) => ({
          passengerId: p.customer?.id || undefined,
          firstName: p.customer?.firstName || p.firstName,
          lastName: p.customer?.lastName || p.lastName,
          seatNo: p.seatNo?.trim() || undefined,
        })),
      };

      const sub = this.bookingService.createGroupBooking(groupReq).subscribe({
        next: async (res) => {
          this.booking = false;
          this.booked = true;
          this.groupBookingResult = res;
          await this.tryPrintOrder(
            res.orderId,
            (res.tickets || []).map((ticket) => ticket.id),
          );
          this.router.navigateByUrl('/tickets');
          this.cdr.markForCheck();
          this.alertService.success(this.t('TICKETS.SELL.SUCCESS'));
        },
        error: (error) => {
          this.handleBookingCreateError(error);
        },
      });
      this.subscriptions.add(sub);
    } else {
      const p = this.passengers[0];
      const request: BookingRequest = {
        tripId: this.selectedTrip.id,
        originPlaceId,
        destinationPlaceId,
        pickupPointId: this.selectedPickupId || '',
        dropoffPointId: this.selectedDropoffId || '',
        passengerId: p.customer?.id,
        contact: this.buildBookingContactInput(),
        idempotencyKey: uuid(),
        seatNo: p.seatNo?.trim() || undefined,
      };

      const sub = this.bookingService.createBooking(request).subscribe({
        next: async (res) => {
          this.booking = false;
          this.booked = true;
          this.bookingResult = res;
          await this.tryPrintTicket(res.id);
          this.alertService.success(this.t('TICKETS.SELL.SUCCESS'));
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleBookingCreateError(error);
        },
      });
      this.subscriptions.add(sub);
    }
  }

  cancelPendingBooking(): void {
    this.stopSeatAvailabilityPolling();
    this.resetBookingState();
    this.step = 1;
    this.cdr.markForCheck();
  }

  private resetBookingState(): void {
    this.bookingResult = null;
    this.groupBookingResult = null;
    this.booking = false;
    this.booked = false;
  }

  /** Grand total for group booking: unitPrice * passengers. */
  get grandTotal(): number {
    return this.displayPrice * this.passengers.length;
  }

  goToTickets(): void {
    this.router.navigate(['/tickets']);
  }

  goBack(): void {
    if (this.step === 4 && this.hasVisualLayout) {
      this.step = 3;
      this.startSeatAvailabilityPolling();
      this.cdr.markForCheck();
      return;
    }
    if (this.step === 3) {
      this.stopSeatAvailabilityPolling();
    }
    if (this.step > 1) {
      this.step--;
    }
    this.cdr.markForCheck();
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

  private buildBookingContactInput(): BookingCustomerInput | undefined {
    if (this.contactCustomer) {
      return undefined;
    }

    return {
      firstName: this.contactPassenger?.firstName?.trim() || undefined,
      lastName: this.contactPassenger?.lastName?.trim() || undefined,
      email: this.quickCustomerEmail,
      phone: this.quickCustomerPhone,
    };
  }

  private createQuickCustomerDraft(): QuickCustomerDraft {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phoneCountryCode: '216',
      phoneNumber: '',
    };
  }

  private async tryPrintTicket(ticketId?: string | null): Promise<void> {
    if (!ticketId) {
      return;
    }

    try {
      await this.ticketPrintService.printTicket(ticketId);
    } catch {
      this.alertService.error(this.t('TICKETS.MESSAGES.PRINT_ERROR'));
    }
  }

  private async tryPrintOrder(
    orderId?: string | null,
    ticketIds: string[] = [],
  ): Promise<void> {
    if (!orderId || !ticketIds.length) {
      return;
    }

    try {
      await this.ticketPrintService.printOrder(orderId, ticketIds);
    } catch {
      this.alertService.error(this.t('TICKETS.MESSAGES.PRINT_ERROR'));
    }
  }

  private buildQuickCustomerPassenger(seatNo?: string): SellPassenger {
    return {
      firstName: this.quickCustomer.firstName.trim(),
      lastName: this.quickCustomer.lastName.trim(),
      seatNo,
      isGuest: false,
    };
  }

  private syncQuickCustomerPassenger(forceCreate = false): void {
    const seatNo = this.passengers[0]?.seatNo;

    if (!forceCreate && !this.hasQuickCustomerDraft) {
      if (this.passengers.length > 0 && !this.passengers[0].customer) {
        this.passengers.splice(0, 1);
      }
      return;
    }

    const contactPassenger = this.buildQuickCustomerPassenger(seatNo);
    if (this.passengers.length === 0) {
      this.passengers.push(contactPassenger);
      return;
    }

    this.passengers[0] = contactPassenger;
  }
  // ─── ROUTE PREVIEW ─────────────────────────────────────
  routePreview(trip: TripType): string {
    if (!trip?.stopSchedule?.length) return '-';
    const stops = [...trip.stopSchedule].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const names = stops.map((s) => (s.place?.city || s.placeId || '-').trim());
    return names.join(' → ');
  }

  ngOnDestroy(): void {
    this.stopSeatAvailabilityPolling();
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
  }

  private loadRouteOccupiedSeats(): void {
    const tripId = this.selectedTrip?.id;
    const originPlaceId = this.getSelectedPickupPlaceId();
    const destinationPlaceId = this.getSelectedDropoffPlaceId();
    if (
      !tripId ||
      !originPlaceId ||
      !destinationPlaceId ||
      !this.hasVisualLayout
    ) {
      this.occupiedSeats = [];
      this.cdr.markForCheck();
      return;
    }

    const sub = this.bookingService
      .getRouteOccupiedSeats(tripId, originPlaceId, destinationPlaceId)
      .subscribe({
        next: (seats) => {
          this.occupiedSeats = seats || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.occupiedSeats = [];
          this.cdr.markForCheck();
        },
      });
    this.subscriptions.add(sub);
  }

  private startSeatAvailabilityPolling(): void {
    this.stopSeatAvailabilityPolling();
    if (!this.hasVisualLayout) {
      return;
    }

    this.loadRouteOccupiedSeats();
    this.seatPollingSubscription = interval(10000).subscribe(() => {
      if (this.step === 3) {
        this.loadRouteOccupiedSeats();
      }
    });
    this.subscriptions.add(this.seatPollingSubscription);
  }

  private stopSeatAvailabilityPolling(): void {
    this.seatPollingSubscription?.unsubscribe();
    this.seatPollingSubscription = null;
  }

  private handleBookingCreateError(error: unknown): void {
    this.booking = false;

    const conflicts = this.extractConflictingSeats(error);
    if (conflicts.length > 0) {
      this.clearConflictingSeats(conflicts);
      this.currentSeatAssignIndex = this.passengers.findIndex((p) => !p.seatNo);
      if (this.currentSeatAssignIndex < 0) {
        this.currentSeatAssignIndex = 0;
      }
      this.step = this.hasVisualLayout ? 3 : this.step;
      this.startSeatAvailabilityPolling();
      this.cdr.markForCheck();
      this.alertService.error(
        'Seat no longer available',
        `Seat${conflicts.length > 1 ? 's' : ''} ${conflicts.join(', ')} ${conflicts.length > 1 ? 'are' : 'is'} no longer available. Please choose another seat.`,
      );
      return;
    }

    this.cdr.markForCheck();
    this.alertService.error(this.t('TICKETS.SELL.ERROR'));
  }

  private extractConflictingSeats(error: unknown): string[] {
    const httpError = error as HttpErrorResponse | null;
    const conflicts = Array.isArray(httpError?.error?.conflicts)
      ? httpError?.error?.conflicts
      : [];
    return conflicts
      .filter((seat): seat is string => typeof seat === 'string')
      .map((seat) => seat.trim())
      .filter((seat) => !!seat);
  }

  private clearConflictingSeats(conflicts: string[]): void {
    const conflictingSet = new Set(conflicts);
    this.passengers.forEach((passenger) => {
      if (passenger.seatNo && conflictingSet.has(passenger.seatNo)) {
        passenger.seatNo = undefined;
      }
    });
  }

  private formatPhone(phone: PhoneType | null | undefined): string | null {
    const countryCode = phone?.countryCode?.trim();
    const number = phone?.number?.trim();
    if (!countryCode && !number) {
      return null;
    }
    if (!countryCode) {
      return number || null;
    }
    return `${countryCode} ${number || ''}`.trim();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
