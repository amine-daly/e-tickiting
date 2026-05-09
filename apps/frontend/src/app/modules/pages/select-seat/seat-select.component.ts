import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, take } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { TripService } from '../bus/trip.service';
import {
  BookingService,
  BookingRequest,
} from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  getSegmentFromPlaceId,
  getSegmentToPlaceId,
  SegmentType,
  TripRouteAvailabilityType,
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
  booking = false;
  booked = false;
  ticketId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService,
    private bookingService: BookingService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const tripId = qp.get('tripId') || '';
    this.originPlaceId = qp.get('originPlaceId') || '';
    this.destPlaceId = qp.get('destinationPlaceId') || '';
    this.pickupPointId = qp.get('pickupPointId') || '';
    this.dropoffPointId = qp.get('dropoffPointId') || '';

    if (tripId) {
      this.tripService
        .getTripById(tripId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((trip) => {
          this.trip = trip;
          this.resolveLabels();
          this.loadRoutePreview();
        });
    }
  }

  confirmBooking(): void {
    if (
      !this.trip ||
      this.booking ||
      this.routeAvailability?.sellable === false
    )
      return;

    this.authService.currentUser$.pipe(take(1)).subscribe((user) => {
      if (!user) {
        this.router.navigate(['/auth/login']);
        return;
      }

      this.booking = true;
      const request: BookingRequest = {
        tripId: this.trip!.id,
        fromPlaceId: this.originPlaceId,
        toPlaceId: this.destPlaceId,
        pickupPointId: this.pickupPointId,
        dropoffPointId: this.dropoffPointId,
        passengerId: user.id,
        idempotencyKey: uuid(),
      };

      this.bookingService
        .createBooking(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.booking = false;
            this.booked = true;
            this.ticketId = res.id;
          },
          error: () => {
            this.booking = false;
          },
        });
    });
  }

  goToVerification(): void {
    if (this.ticketId) {
      this.router.navigate(['/verification'], {
        queryParams: { ticketId: this.ticketId },
      });
    }
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
    this.duration = chain.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);

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
        },
        error: () => {
          this.routeAvailability = null;
          this.displayPrice = 0;
          this.availableSeats = 0;
        },
      });
  }

  private getSegmentChain(): SegmentType[] {
    if (!this.trip?.segments) return [];
    const sorted = [...this.trip.segments].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const startIdx = sorted.findIndex(
      (s) => getSegmentFromPlaceId(s) === this.originPlaceId,
    );
    const endIdx = sorted.findIndex(
      (s) => getSegmentToPlaceId(s) === this.destPlaceId,
    );
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return sorted;
    return sorted.slice(startIdx, endIdx + 1);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
