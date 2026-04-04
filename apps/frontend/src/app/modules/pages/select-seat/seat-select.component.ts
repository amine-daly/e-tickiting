import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, take } from 'rxjs';

import { TripService } from '../bus/trip.service';
import { PlacesService } from '../../home/home.service';
import { BookingService, BookingRequest } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  TripType,
  SegmentType,
} from '../../../core/models/trip.model';
import { PlaceType } from '../../../core/models/place-type';

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
  places: PlaceType[] = [];
  originPlaceId = '';
  destPlaceId = '';
  pickupPointId = '';
  dropoffPointId = '';

  displayPrice = 0;
  availableSeats = 0;
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
    private placesService: PlacesService,
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

    this.placesService.fetchPlaces().pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.places = p;
      this.resolveLabels();
    });

    if (tripId) {
      this.tripService
        .getTripById(tripId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((trip) => {
          this.trip = trip;
          this.computeDetails();
          this.resolveLabels();
        });
    }
  }

  confirmBooking(): void {
    if (!this.trip || this.booking) return;

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
        idempotencyKey: crypto.randomUUID(),
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
    return this.places.find((p) => p.id === placeId)?.city || placeId;
  }

  getPickupAddress(): string {
    return this.trip?.pickupPoints?.find((p) => p.pointId === this.pickupPointId)?.address || '';
  }

  getDropoffAddress(): string {
    return this.trip?.dropoffPoints?.find((p) => p.pointId === this.dropoffPointId)?.address || '';
  }

  private resolveLabels(): void {
    this.originCity = this.getPlaceName(this.originPlaceId);
    this.destCity = this.getPlaceName(this.destPlaceId);
  }

  private computeDetails(): void {
    if (!this.trip) return;
    const chain = this.getSegmentChain();

    const express = (this.trip.expressFares || []).find(
      (f) =>
        f.fromPlaceId === this.originPlaceId &&
        f.toPlaceId === this.destPlaceId &&
        f.active
    );
    this.displayPrice = express
      ? express.price
      : chain.reduce((s, seg) => s + (seg.basePrice || 0), 0);
    this.duration = chain.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);
    this.availableSeats = chain.length
      ? Math.min(...chain.map((s) => (s.maxSeats || 0) - (s.bookedSeats || 0)))
      : 0;
  }

  private getSegmentChain(): SegmentType[] {
    if (!this.trip?.segments) return [];
    const sorted = [...this.trip.segments].sort((a, b) => a.sequence - b.sequence);
    const startIdx = sorted.findIndex((s) => s.fromPlaceId === this.originPlaceId);
    const endIdx = sorted.findIndex((s) => s.toPlaceId === this.destPlaceId);
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return sorted;
    return sorted.slice(startIdx, endIdx + 1);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
