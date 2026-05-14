import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, interval, takeUntil, takeWhile } from 'rxjs';
import { v4 as uuid } from 'uuid';

import {
  FrontofficeBookingDraft,
  FrontofficeCreateHoldRequest,
  FrontofficeHoldResponse,
} from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
import { FrontofficeBookingDraftService } from '../../../core/services/frontoffice-booking-draft.service';
import { TripType } from '../../../core/models/trip.model';
import { TripService } from '../bus/trip.service';

@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.scss'],
})
export class VerificationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  trip: TripType | null = null;
  draft: FrontofficeBookingDraft | null = null;
  hold: FrontofficeHoldResponse | null = null;
  loadingHold = false;
  submittingHold = false;
  confirmingHold = false;
  cancellingHold = false;
  pendingHold = false;
  expiresAt: Date | null = null;
  countdownDisplay = '';
  countdownExpired = false;
  notice = '';
  private countdownSubscription: Subscription | null = null;

  form = this.fb.group({
    contact: this.fb.group({
      firstName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lastName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
    }),
    passengers: this.fb.array<FormGroup>([]),
    termsAccepted: this.fb.control(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
    priceAccepted: this.fb.control(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private draftService: FrontofficeBookingDraftService,
    private tripService: TripService,
  ) {}

  ngOnInit(): void {
    this.draft = this.draftService.getDraft();
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const holdToken = params.get('holdToken');
        if (holdToken) {
          if (this.hold?.holdToken === holdToken) {
            return;
          }
          this.loadHold(holdToken);
          return;
        }

        this.hold = null;
        this.notice = '';
        this.stopCountdown();
        this.initializeDraftState();
      });
  }

  get passengersArray(): FormArray<FormGroup> {
    return this.form.controls.passengers;
  }

  get contactGroup(): FormGroup {
    return this.form.controls.contact as FormGroup;
  }

  get selectedSeats(): string[] {
    if (this.hold?.passengers?.length) {
      return this.hold.passengers
        .map((passenger) => passenger.seatNo)
        .filter((seatNo): seatNo is string => !!seatNo);
    }
    return this.draft?.selectedSeatNos || [];
  }

  get totalPrice(): number {
    return (
      this.hold?.totalPrice ||
      (this.draft ? this.draft.displayPrice * this.draft.passengerCount : 0)
    );
  }

  get currencyCode(): string {
    return (
      this.hold?.currency ||
      this.draft?.currencyCode ||
      this.trip?.currency?.code ||
      ''
    );
  }

  get passengerCount(): number {
    return this.hold?.passengers?.length || this.draft?.passengerCount || 1;
  }

  get hasPendingHold(): boolean {
    return (
      !!this.hold && this.hold.status === 'PENDING' && !this.countdownExpired
    );
  }

  get hasConfirmedHold(): boolean {
    return !!this.hold && this.hold.status === 'CONFIRMED';
  }

  get mainActionLabel(): string {
    if (this.submittingHold) {
      return 'Holding seats...';
    }
    if (this.confirmingHold) {
      return 'Confirming booking...';
    }
    if (this.hasConfirmedHold) {
      return 'Payment coming soon';
    }
    if (this.hasPendingHold) {
      return 'Confirm booking';
    }
    return 'Hold seats';
  }

  get mainActionDisabled(): boolean {
    if (
      this.loadingHold ||
      this.submittingHold ||
      this.confirmingHold ||
      this.cancellingHold
    ) {
      return true;
    }
    if (this.hasConfirmedHold) {
      return true;
    }
    return false;
  }

  isControlInvalid(control: FormControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  holdOrConfirm(): void {
    if (this.hasConfirmedHold) {
      return;
    }

    if (this.hasPendingHold && this.hold) {
      this.confirmingHold = true;
      this.bookingService
        .confirmFrontofficeHold(this.hold.holdToken)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (hold) => {
            this.confirmingHold = false;
            this.hold = hold;
            this.notice =
              'Booking confirmed. The payment step will be wired next.';
            this.pendingHold = false;
            this.draftService.clearDraft();
            this.startCountdown(hold.expiresAt || null, hold.status);
          },
          error: () => {
            this.confirmingHold = false;
            this.notice = 'We could not confirm your booking right now.';
          },
        });
      return;
    }

    if (this.form.invalid || !this.draft) {
      this.form.markAllAsTouched();
      return;
    }

    const request = this.buildCreateHoldRequest();
    if (!request) {
      this.notice = 'Your seat selection is incomplete.';
      return;
    }

    this.submittingHold = true;
    this.bookingService
      .createFrontofficeHold(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hold) => {
          this.submittingHold = false;
          this.hold = hold;
          this.notice = 'Seats are now held for 10 minutes.';
          this.pendingHold = true;
          this.draftService.updateDraft({ holdToken: hold.holdToken });
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { holdToken: hold.holdToken },
            queryParamsHandling: 'merge',
          });
          this.startCountdown(hold.expiresAt || null, hold.status);
        },
        error: () => {
          this.submittingHold = false;
          this.notice = 'We could not hold the selected seats.';
        },
      });
  }

  cancelHold(): void {
    if (!this.hold || this.hold.status !== 'PENDING') {
      return;
    }

    this.releaseCurrentHold('The pending hold was released.');
  }

  private releaseCurrentHold(successNotice: string): void {
    if (!this.hold || this.hold.status !== 'PENDING' || this.cancellingHold) {
      return;
    }

    this.cancellingHold = true;
    this.bookingService
      .cancelFrontofficeHold(this.hold.holdToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cancellingHold = false;
          this.hold = null;
          this.stopCountdown();
          this.notice = successNotice;
          this.draftService.updateDraft({ holdToken: null });
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { holdToken: null },
            queryParamsHandling: 'merge',
          });
        },
        error: () => {
          this.cancellingHold = false;
          this.notice = 'We could not release the current hold.';
        },
      });
  }

  goBackToSeats(): void {
    if (!this.draft) {
      this.router.navigate(['/']);
      return;
    }

    this.router.navigate(['/seat-select'], {
      queryParams: {
        tripId: this.draft.tripId,
        originPlaceId: this.draft.originPlaceId,
        destinationPlaceId: this.draft.destinationPlaceId,
        pickupPointId: this.draft.pickupPointId,
        dropoffPointId: this.draft.dropoffPointId,
      },
    });
  }

  getPlaceName(placeId?: string | null): string {
    if (!placeId) {
      return '-';
    }
    const stop = this.trip?.stopSchedule?.find(
      (item) => item.placeId === placeId,
    );
    return stop?.place?.city || placeId;
  }

  getPickupAddress(): string {
    if (!this.hold?.pickupPointId && !this.draft?.pickupPointId) {
      return '';
    }
    const pointId = this.hold?.pickupPointId || this.draft?.pickupPointId;
    return (
      this.trip?.pickupPoints?.find((item) => item.pointId === pointId)
        ?.address || ''
    );
  }

  getDropoffAddress(): string {
    if (!this.hold?.dropoffPointId && !this.draft?.dropoffPointId) {
      return '';
    }
    const pointId = this.hold?.dropoffPointId || this.draft?.dropoffPointId;
    return (
      this.trip?.dropoffPoints?.find((item) => item.pointId === pointId)
        ?.address || ''
    );
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeDraftState(): void {
    if (!this.draft) {
      this.notice =
        'No seat selection was found. Please start from the trip page.';
      this.passengersArray.clear();
      return;
    }

    this.ensureGuestControls(Math.max(this.draft.passengerCount - 1, 0));
    this.loadTrip(
      this.draft.tripId,
      this.draft.originPlaceId,
      this.draft.destinationPlaceId,
    );
  }

  private loadHold(holdToken: string): void {
    this.loadingHold = true;
    this.bookingService
      .getFrontofficeHold(holdToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hold) => {
          this.loadingHold = false;
          this.hold = hold;
          this.pendingHold = hold.status === 'PENDING';
          this.ensureGuestControls(
            Math.max((hold.passengers?.length || 1) - 1, 0),
          );
          this.patchFormFromHold(hold);

          const nextDraft: FrontofficeBookingDraft = {
            holdToken: hold.holdToken,
            tripId: hold.tripId,
            originPlaceId: this.draft?.originPlaceId || '',
            destinationPlaceId: this.draft?.destinationPlaceId || '',
            pickupPointId:
              hold.pickupPointId || this.draft?.pickupPointId || '',
            dropoffPointId:
              hold.dropoffPointId || this.draft?.dropoffPointId || '',
            displayPrice:
              hold.passengers?.[0]?.appliedPrice ||
              (hold.passengers?.length
                ? hold.totalPrice / hold.passengers.length
                : hold.totalPrice),
            currencyCode: hold.currency,
            passengerCount: hold.passengers?.length || 1,
            selectedSeatNos: hold.passengers
              .map((passenger) => passenger.seatNo)
              .filter((seatNo): seatNo is string => !!seatNo),
          };

          this.draft = nextDraft;
          this.draftService.saveDraft(nextDraft);
          this.loadTrip(
            nextDraft.tripId,
            nextDraft.originPlaceId,
            nextDraft.destinationPlaceId,
          );
          this.startCountdown(hold.expiresAt || null, hold.status);
        },
        error: () => {
          this.loadingHold = false;
          this.notice = 'The selected hold could not be loaded.';
        },
      });
  }

  private patchFormFromHold(hold: FrontofficeHoldResponse): void {
    const contactPassenger = hold.passengers?.[0];
    this.contactGroup.patchValue({
      firstName: hold.contact?.firstName || contactPassenger?.firstName || '',
      lastName: hold.contact?.lastName || contactPassenger?.lastName || '',
      email: hold.contact?.email || contactPassenger?.email || '',
    });

    const guestPassengers = hold.passengers?.slice(1) || [];
    guestPassengers.forEach((passenger, index) => {
      const group = this.passengersArray.at(index);
      if (!group) {
        return;
      }
      group.patchValue({
        firstName: passenger.firstName || '',
        lastName: passenger.lastName || '',
      });
    });
  }

  private buildCreateHoldRequest(): FrontofficeCreateHoldRequest | null {
    if (!this.draft) {
      return null;
    }

    const formValue = this.form.getRawValue();
    return {
      holdToken: this.draft.holdToken || uuid(),
      tripId: this.draft.tripId,
      originPlaceId: this.draft.originPlaceId,
      destinationPlaceId: this.draft.destinationPlaceId,
      pickupPointId: this.draft.pickupPointId,
      dropoffPointId: this.draft.dropoffPointId,
      contact: {
        firstName: formValue.contact.firstName,
        lastName: formValue.contact.lastName,
        email: formValue.contact.email,
        seatNo: this.draft.selectedSeatNos[0] || null,
      },
      passengers: formValue.passengers.map((passenger, index) => ({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        seatNo: this.draft?.selectedSeatNos[index + 1] || null,
      })),
    };
  }

  private ensureGuestControls(count: number): void {
    while (this.passengersArray.length < count) {
      this.passengersArray.push(this.buildGuestGroup());
    }
    while (this.passengersArray.length > count) {
      this.passengersArray.removeAt(this.passengersArray.length - 1);
    }
  }

  private buildGuestGroup(): FormGroup {
    return this.fb.group({
      firstName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lastName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
  }

  private loadTrip(
    tripId: string,
    originPlaceId?: string | null,
    destinationPlaceId?: string | null,
  ): void {
    const routeSelection =
      originPlaceId && destinationPlaceId
        ? {
            originPlaceId,
            destinationPlaceId,
          }
        : undefined;

    this.tripService
      .getTripById(tripId, routeSelection)
      .pipe(takeUntil(this.destroy$))
      .subscribe((trip) => {
        this.trip = trip;
        this.syncDraftRouteIds(trip);
      });
  }

  private syncDraftRouteIds(trip: TripType): void {
    if (!this.draft) {
      return;
    }

    const pickupPointId = this.hold?.pickupPointId || this.draft.pickupPointId;
    const dropoffPointId =
      this.hold?.dropoffPointId || this.draft.dropoffPointId;
    const pickupPoint = trip.pickupPoints?.find(
      (point) => point.pointId === pickupPointId,
    );
    const dropoffPoint = trip.dropoffPoints?.find(
      (point) => point.pointId === dropoffPointId,
    );

    const nextDraft: FrontofficeBookingDraft = {
      ...this.draft,
      originPlaceId: this.draft.originPlaceId || pickupPoint?.placeId || '',
      destinationPlaceId:
        this.draft.destinationPlaceId || dropoffPoint?.placeId || '',
    };

    this.draft = nextDraft;
    this.draftService.saveDraft(nextDraft);
  }

  private startCountdown(expiresAt: string | null, status: string): void {
    this.clearCountdownSubscription();
    this.expiresAt = expiresAt ? new Date(expiresAt) : null;
    this.pendingHold = !!this.expiresAt && status === 'PENDING';
    this.countdownExpired = false;
    this.updateCountdownDisplay();

    if (!this.pendingHold) {
      return;
    }

    if (this.countdownExpired) {
      this.onCountdownExpired();
      return;
    }

    this.countdownSubscription = interval(1000)
      .pipe(
        takeUntil(this.destroy$),
        takeWhile(() => this.pendingHold && !this.countdownExpired),
      )
      .subscribe(() => {
        this.updateCountdownDisplay();
        if (this.countdownExpired) {
          this.onCountdownExpired();
        }
      });
  }

  private updateCountdownDisplay(): void {
    if (!this.expiresAt) {
      this.countdownDisplay = '';
      return;
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((this.expiresAt.getTime() - Date.now()) / 1000),
    );

    if (remainingSeconds <= 0) {
      this.countdownDisplay = '00:00';
      this.countdownExpired = true;
      return;
    }

    const mins = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (remainingSeconds % 60).toString().padStart(2, '0');
    this.countdownDisplay = `${mins}:${secs}`;
  }

  private onCountdownExpired(): void {
    this.pendingHold = false;
    this.notice = 'The seat hold expired. Releasing it now.';
    this.releaseCurrentHold('The seat hold expired. You can create a new one.');
  }

  private stopCountdown(): void {
    this.pendingHold = false;
    this.expiresAt = null;
    this.countdownExpired = false;
    this.countdownDisplay = '';
    this.clearCountdownSubscription();
  }

  private clearCountdownSubscription(): void {
    this.countdownSubscription?.unsubscribe();
    this.countdownSubscription = null;
  }
}
