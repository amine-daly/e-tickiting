import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { v4 as uuid } from 'uuid';

import {
  FrontofficeBookingDraft,
  FrontofficeCreateHoldRequest,
  FrontofficeHoldResponse,
} from '../../../core/models/booking.model';
import { TargetInput } from '../../../core/models/shared.model';
import { BookingService } from '../../../core/services/booking.service';
import { FrontofficeBookingDraftService } from '../../../core/services/frontoffice-booking-draft.service';
import { TripType } from '../../../core/models/trip.model';
import { TicketStatus } from '../../../core/models/ticket.model';
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
  notice = '';

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
  });

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private bookingService: BookingService,
    private draftService: FrontofficeBookingDraftService,
    private tripService: TripService,
  ) {}

  ngOnInit(): void {
    this.draft = this.draftService.getDraft();
    console.log(
      '🚀 ~ VerificationComponent ~ ngOnInit ~ this.draft:',
      this.draft,
    );
    if (this.draft?.holdToken) {
      this.loadHold(this.draft.holdToken);
      return;
    }

    this.hold = null;
    this.notice = '';
    this.initializeDraftState();
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
    return !!this.hold && this.hold.status === TicketStatus.PENDING;
  }

  get hasConfirmedHold(): boolean {
    return !!this.hold && this.hold.status === TicketStatus.CONFIRMED;
  }

  get mainActionLabel(): string {
    if (this.submittingHold) {
      return 'Creating booking...';
    }
    if (this.confirmingHold) {
      return 'Confirming payment...';
    }
    if (this.hasConfirmedHold) {
      return 'Payment confirmed';
    }
    if (this.hasPendingHold) {
      return 'Complete payment';
    }
    return 'Continue to payment';
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
    console.log(1);
    if (this.hasPendingHold && this.hold) {
      console.log(2);
      this.confirmingHold = true;
      this.bookingService
        .confirmFrontofficeHold(this.hold)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (hold) => {
            this.confirmingHold = false;
            this.hold = hold;
            this.notice =
              'Booking confirmed. The payment step will be wired next.';
            this.updateDraft({ holdToken: null });
          },
          error: (error) => {
            this.handleConfirmError(error);
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
          this.notice =
            'Booking created. Complete payment to finish confirmation.';
          this.updateDraft({ holdToken: hold.holdToken });
        },
        error: (error) => {
          this.handleCreateError(error);
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
      .cancelFrontofficeHold(this.hold)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cancellingHold = false;
          this.hold = null;
          this.notice = successNotice;
          this.updateDraft({ holdToken: null });
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
          console.log(
            '🚀 ~ VerificationComponent ~ loadHold ~ this.hold:',
            this.hold,
          );
          this.ensureGuestControls(
            Math.max((hold.passengers?.length || 1) - 1, 0),
          );
          this.patchFormFromHold(hold);

          const nextDraft: FrontofficeBookingDraft = {
            holdToken:
              hold.status === TicketStatus.PENDING ? hold.holdToken : null,
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
          this.notice =
            hold.status === TicketStatus.CONFIRMED
              ? 'Booking confirmed. The payment step will be wired next.'
              : 'Booking created. Complete payment to finish confirmation.';
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
    const target = this.buildTargetInput();
    return {
      holdToken: this.draft.holdToken || uuid(),
      tripId: this.draft.tripId,
      originPlaceId: this.draft.originPlaceId,
      destinationPlaceId: this.draft.destinationPlaceId,
      pickupPointId: this.draft.pickupPointId,
      dropoffPointId: this.draft.dropoffPointId,
      target: target ?? undefined,
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

  private buildTargetInput(): TargetInput | null {
    const companyId = this.resolveTripCompanyId();
    if (!companyId) {
      return null;
    }
    return {
      company: companyId,
    };
  }

  private resolveTripCompanyId(): string | null {
    const company = this.trip?.target?.company;
    if (!company) {
      return null;
    }
    if (typeof company === 'string') {
      return company;
    }
    return company.id || null;
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

  private handleCreateError(error: unknown): void {
    this.submittingHold = false;
    if (this.handleSeatConflict(error)) {
      return;
    }
    this.notice = 'We could not create your booking right now.';
  }

  private handleConfirmError(error: unknown): void {
    this.confirmingHold = false;
    if (this.isHoldExpired(error)) {
      this.hold = null;
      this.updateDraft({ holdToken: null });
      this.notice =
        'Your booking expired before payment completed. Please choose seats again.';
      this.goBackToSeats();
      return;
    }
    this.notice = 'We could not confirm your booking right now.';
  }

  private handleSeatConflict(error: unknown): boolean {
    const conflicts = this.extractConflictingSeats(error);
    if (!conflicts.length || !this.draft) {
      return false;
    }

    const conflictSet = new Set(conflicts);
    const nextDraft: FrontofficeBookingDraft = {
      ...this.draft,
      holdToken: null,
      selectedSeatNos: this.draft.selectedSeatNos.filter(
        (seatNo) => !conflictSet.has(seatNo),
      ),
    };

    this.draft = nextDraft;
    this.hold = null;
    this.draftService.saveDraft(nextDraft);
    this.notice = `Seat${conflicts.length > 1 ? 's' : ''} ${conflicts.join(', ')} ${conflicts.length > 1 ? 'are' : 'is'} no longer available. Please choose another seat.`;
    this.goBackToSeats();
    return true;
  }

  private extractConflictingSeats(error: unknown): string[] {
    const httpError = error as HttpErrorResponse | null;
    const conflicts = Array.isArray(httpError?.error?.conflicts)
      ? httpError.error.conflicts
      : [];
    return conflicts
      .filter((seat): seat is string => typeof seat === 'string')
      .map((seat) => seat.trim())
      .filter((seat) => !!seat);
  }

  private isHoldExpired(error: unknown): boolean {
    const httpError = error as HttpErrorResponse | null;
    return (
      httpError?.status === 410 || httpError?.error?.code === 'HOLD_EXPIRED'
    );
  }

  private updateDraft(patch: Partial<FrontofficeBookingDraft>): void {
    if (!this.draft) {
      return;
    }
    const nextDraft: FrontofficeBookingDraft = {
      ...this.draft,
      ...patch,
    };
    this.draft = nextDraft;
    this.draftService.saveDraft(nextDraft);
  }
}
