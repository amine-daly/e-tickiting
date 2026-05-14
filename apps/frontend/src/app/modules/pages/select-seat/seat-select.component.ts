import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, interval, takeUntil } from 'rxjs';

import { TripService } from '../bus/trip.service';
import { BookingService } from '../../../core/services/booking.service';
import { FrontofficeBookingDraftService } from '../../../core/services/frontoffice-booking-draft.service';
import { FrontofficeBookingDraft } from '../../../core/models/booking.model';
import {
  BusLayoutElement,
  BusLayoutTemplate,
  SegmentType,
  TripRouteAvailabilityType,
  TripRouteSelection,
  TripType,
} from '../../../core/models/trip.model';

@Component({
  selector: 'app-seat-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seat-select.component.html',
  styleUrls: ['./seat-select.component.scss'],
})
export class SeatSelectComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private seatPollingSubscription: Subscription | null = null;
  readonly LayoutElementType = {
    SEAT: 'SEAT',
    DRIVER: 'DRIVER',
    DOOR: 'DOOR',
    STAIRS: 'STAIRS',
    TOILET: 'TOILET',
  } as const;

  trip: TripType | null = null;
  originPlaceId = '';
  destPlaceId = '';
  pickupPointId = '';
  dropoffPointId = '';

  displayPrice = 0;
  availableSeats = 0;
  routeAvailability: TripRouteAvailabilityType | null = null;
  duration = 0;
  originCity = '';
  destCity = '';
  passengerCount = 1;
  occupiedSeats: string[] = [];
  selectedSeatNos: string[] = [];
  activeDeck: 'lower' | 'upper' = 'lower';
  loadingOccupiedSeats = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService,
    private bookingService: BookingService,
    private draftService: FrontofficeBookingDraftService,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const tripId = qp.get('tripId') || '';
    this.originPlaceId = qp.get('originPlaceId') || '';
    this.destPlaceId = qp.get('destinationPlaceId') || '';
    this.pickupPointId = qp.get('pickupPointId') || '';
    this.dropoffPointId = qp.get('dropoffPointId') || '';

    if (tripId) {
      const routeSelection: TripRouteSelection = {
        originPlaceId: this.originPlaceId,
        destinationPlaceId: this.destPlaceId,
      };

      this.tripService
        .getTripById(tripId, routeSelection)
        .pipe(takeUntil(this.destroy$))
        .subscribe((trip) => {
          this.trip = trip;
          this.resolveLabels();
          this.loadRoutePreview();
        });
    }
  }

  continueToVerification(): void {
    if (!this.trip || !this.canContinue) {
      return;
    }

    const draft: FrontofficeBookingDraft = {
      tripId: this.trip.id,
      originPlaceId: this.originPlaceId,
      destinationPlaceId: this.destPlaceId,
      pickupPointId: this.pickupPointId,
      dropoffPointId: this.dropoffPointId,
      displayPrice: this.displayPrice,
      currencyCode:
        this.trip.currency?.code || this.routeAvailability?.currencyCode || '',
      passengerCount: this.passengerCount,
      selectedSeatNos: [...this.selectedSeatNos],
    };

    this.draftService.saveDraft(draft);
    this.router.navigate(['/verification']);
  }

  getPlaceName(placeId: string): string {
    const stop = this.trip?.stopSchedule?.find((s) => s.placeId === placeId);
    return stop?.place?.city || placeId;
  }

  getPickupAddress(): string {
    return (
      this.trip?.pickupPoints?.find((p) => p.pointId === this.pickupPointId)
        ?.address || ''
    );
  }

  getDropoffAddress(): string {
    return (
      this.trip?.dropoffPoints?.find((p) => p.pointId === this.dropoffPointId)
        ?.address || ''
    );
  }

  private resolveLabels(): void {
    this.originCity = this.getPlaceName(this.originPlaceId);
    this.destCity = this.getPlaceName(this.destPlaceId);
  }

  private loadRoutePreview(): void {
    if (!this.trip) return;
    const chain = this.getSegmentChain();
    this.duration =
      this.trip.marketplace?.schedule?.durationMinutes ||
      chain.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);

    if (!this.originPlaceId || !this.destPlaceId) {
      this.routeAvailability = null;
      this.displayPrice = 0;
      this.availableSeats = 0;
      return;
    }

    this.tripService
      .getRouteAvailability(this.trip.id, this.originPlaceId, this.destPlaceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (availability) => {
          this.routeAvailability = availability;
          this.displayPrice = availability.displayPrice || 0;
          this.availableSeats = availability.sellable
            ? availability.availableSeats || 0
            : 0;
          this.setPassengerCount(this.passengerCount);
          this.loadOccupiedSeats();
          this.startSeatPolling();
        },
        error: () => {
          this.routeAvailability = null;
          this.displayPrice = 0;
          this.availableSeats = 0;
          this.occupiedSeats = [];
          this.selectedSeatNos = [];
          this.stopSeatPolling();
        },
      });
  }

  setPassengerCount(count: number): void {
    const maxSeats = this.availableSeats > 0 ? this.availableSeats : 1;
    this.passengerCount = Math.min(Math.max(count, 1), maxSeats);
    if (this.selectedSeatNos.length > this.passengerCount) {
      this.selectedSeatNos = this.selectedSeatNos.slice(0, this.passengerCount);
    }
  }

  selectSeat(seatNo: string | null | undefined): void {
    if (!seatNo || this.isSeatOccupied(seatNo)) {
      return;
    }

    if (this.isSeatSelected(seatNo)) {
      this.selectedSeatNos = this.selectedSeatNos.filter(
        (currentSeatNo) => currentSeatNo !== seatNo,
      );
      return;
    }

    if (this.selectedSeatNos.length >= this.passengerCount) {
      return;
    }

    this.selectedSeatNos = [...this.selectedSeatNos, seatNo];
  }

  removeSeat(seatNo: string): void {
    this.selectedSeatNos = this.selectedSeatNos.filter(
      (currentSeatNo) => currentSeatNo !== seatNo,
    );
  }

  isSeatOccupied(seatNo: string | null | undefined): boolean {
    return (
      !!seatNo &&
      this.occupiedSeats.includes(seatNo) &&
      !this.isSeatSelected(seatNo)
    );
  }

  isSeatSelected(seatNo: string | null | undefined): boolean {
    return !!seatNo && this.selectedSeatNos.includes(seatNo);
  }

  get canContinue(): boolean {
    if (
      !this.trip ||
      this.availableSeats <= 0 ||
      this.routeAvailability?.sellable === false
    ) {
      return false;
    }

    if (!this.hasVisualLayout) {
      return true;
    }

    return this.selectedSeatNos.length === this.passengerCount;
  }

  get hasVisualLayout(): boolean {
    return (
      !!this.layoutTemplate &&
      ((this.layoutTemplate.lowerDeck?.length || 0) > 0 ||
        (this.layoutTemplate.upperDeck?.length || 0) > 0)
    );
  }

  get layoutTemplate(): BusLayoutTemplate | null {
    return this.trip?.bus?.layoutTemplate || null;
  }

  get lowerDeckElements(): BusLayoutElement[] {
    return this.layoutTemplate?.lowerDeck || [];
  }

  get upperDeckElements(): BusLayoutElement[] {
    return this.layoutTemplate?.upperDeck || [];
  }

  get currentDeckElements(): BusLayoutElement[] {
    if (this.activeDeck === 'upper') {
      return this.upperDeckElements;
    }
    return this.lowerDeckElements;
  }

  get passengerLabel(): string {
    return `${this.passengerCount} passenger${this.passengerCount > 1 ? 's' : ''}`;
  }

  get selectedSeats(): string[] {
    return [...this.selectedSeatNos];
  }

  getSeatDeckLabel(seatNo: string): string {
    if (this.upperDeckElements.some((element) => element.seatNo === seatNo)) {
      return 'Upper deck';
    }
    return 'Lower deck';
  }

  setActiveDeck(deck: 'lower' | 'upper'): void {
    this.activeDeck = deck;
  }

  trackByDeckElement(index: number, element: BusLayoutElement): string {
    return (
      element.seatNo ||
      `${element.type || 'EMPTY'}-${element.gridX}-${element.gridY}-${index}`
    );
  }

  private loadOccupiedSeats(): void {
    if (
      !this.trip ||
      !this.originPlaceId ||
      !this.destPlaceId ||
      !this.hasVisualLayout
    ) {
      this.occupiedSeats = [];
      this.stopSeatPolling();
      return;
    }

    this.loadingOccupiedSeats = true;
    this.bookingService
      .getRouteOccupiedSeats(this.trip.id, this.originPlaceId, this.destPlaceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (occupiedSeats) => {
          this.loadingOccupiedSeats = false;
          this.occupiedSeats = occupiedSeats || [];
        },
        error: () => {
          this.loadingOccupiedSeats = false;
          this.occupiedSeats = [];
        },
      });
  }

  private getSegmentChain(): SegmentType[] {
    if (!this.trip?.segments) return [];
    const sorted = [...this.trip.segments].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const startIdx = sorted.findIndex(
      (s) => s.fromPlace?.id === this.originPlaceId,
    );
    const endIdx = sorted.findIndex((s) => s.toPlace?.id === this.destPlaceId);
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return sorted;
    return sorted.slice(startIdx, endIdx + 1);
  }

  ngOnDestroy(): void {
    this.stopSeatPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startSeatPolling(): void {
    this.stopSeatPolling();
    if (!this.hasVisualLayout) {
      return;
    }

    this.seatPollingSubscription = interval(10000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadOccupiedSeats());
  }

  private stopSeatPolling(): void {
    this.seatPollingSubscription?.unsubscribe();
    this.seatPollingSubscription = null;
  }
}
