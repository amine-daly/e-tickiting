import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { TripService } from '../trip.service';
import {
  getExpressSegmentFromPlaceId,
  getExpressSegmentToPlaceId,
  getSegmentFromPlaceId,
  getSegmentToPlaceId,
  TripType,
  PickupPointType,
  DropoffPointType,
  SegmentType,
} from '../../../../core/models/trip.model';

@Component({
  selector: 'app-bus-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
})
export class BusDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  trip: TripType | null = null;
  originPlaceId: string | null = null;
  destPlaceId: string | null = null;
  travelDate: string | null = null;

  selectedPickup: PickupPointType | null = null;
  selectedDropoff: DropoffPointType | null = null;

  displayPrice = 0;
  duration = 0;
  originCity = '';
  destCity = '';

  activePickups: PickupPointType[] = [];
  activeDropoffs: DropoffPointType[] = [];

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
  ) {}

  ngOnInit(): void {
    const tripId = this.route.snapshot.paramMap.get('id')!;
    this.originPlaceId = this.route.snapshot.queryParamMap.get('originPlaceId');
    this.destPlaceId =
      this.route.snapshot.queryParamMap.get('destinationPlaceId');
    this.travelDate = this.route.snapshot.queryParamMap.get('date');

    this.tripService
      .getTripById(tripId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((trip) => {
        this.trip = trip;
        this.activePickups = (trip.pickupPoints || []).filter((p) => p.active);
        this.activeDropoffs = (trip.dropoffPoints || []).filter(
          (p) => p.active,
        );
        if (this.activePickups.length)
          this.selectedPickup = this.activePickups[0];
        if (this.activeDropoffs.length)
          this.selectedDropoff = this.activeDropoffs[0];
        this.computePriceAndDuration();
        this.resolveLabels();
      });
  }

  selectPickup(point: PickupPointType): void {
    this.selectedPickup = point;
  }

  selectDropoff(point: DropoffPointType): void {
    this.selectedDropoff = point;
  }

  getPlaceName(placeId: string): string {
    const stop = this.trip?.stopSchedule?.find((s) => s.placeId === placeId);
    return stop?.place?.city || placeId;
  }

  private resolveLabels(): void {
    if (!this.trip) return;
    const originStop =
      this.trip.stopSchedule?.find((s) => s.placeId === this.originPlaceId) ||
      this.trip.stopSchedule?.[0];
    const destStop =
      this.trip.stopSchedule?.find((s) => s.placeId === this.destPlaceId) ||
      this.trip.stopSchedule?.[this.trip.stopSchedule.length - 1];
    this.originCity = originStop?.place?.city || originStop?.placeId || '';
    this.destCity = destStop?.place?.city || destStop?.placeId || '';
  }

  private computePriceAndDuration(): void {
    if (!this.trip) return;
    const chain = this.getSegmentChain();

    // Check express segment first
    const expressSegment = (this.trip.expressSegments || []).find(
      (candidate) =>
        getExpressSegmentFromPlaceId(candidate) === this.originPlaceId &&
        getExpressSegmentToPlaceId(candidate) === this.destPlaceId &&
        candidate.active,
    );
    this.displayPrice = expressSegment
      ? expressSegment.price
      : chain.reduce((s, seg) => s + (seg.basePrice || 0), 0);
    this.duration = chain.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);
  }

  private getSegmentChain(): SegmentType[] {
    if (!this.trip?.segments) return [];
    const sorted = [...this.trip.segments].sort(
      (a, b) => a.sequence - b.sequence,
    );
    if (!this.originPlaceId || !this.destPlaceId) return sorted;
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
