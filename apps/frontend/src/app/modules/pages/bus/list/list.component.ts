import { Component, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';
import { TripService } from '../trip.service';
import { PlacesService } from '../../../home/home.service';
import { Subject, takeUntil, combineLatest, map } from 'rxjs';
import { TripType, SegmentType, ExpressFareType } from '../../../../core/models/trip.model';
import { PlaceType } from '../../../../core/models/place-type';

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  trips$ = combineLatest([
    this.tripService.filtredTrips$,
    this.placesService.places$,
    this.route.queryParams.pipe(
      map((q) => ({
        originPlaceId: q['originPlaceId'] || null,
        destinationPlaceId: q['destinationPlaceId'] || null,
      }))
    ),
  ]).pipe(
    map(([trips, places, query]) => {
      return (trips || []).map((trip: TripType) => {
        const originStop = trip.stopSchedule?.find(
          (s) => s.placeId === query.originPlaceId && s.boardingAllowed
        ) || trip.stopSchedule?.[0];
        const destStop = trip.stopSchedule?.find(
          (s) => s.placeId === query.destinationPlaceId && s.droppingAllowed
        ) || trip.stopSchedule?.[trip.stopSchedule.length - 1];

        const originPlace = places.find((p) => p.id === originStop?.placeId);
        const destPlace = places.find((p) => p.id === destStop?.placeId);

        const displayPrice = this.computePrice(
          trip,
          query.originPlaceId,
          query.destinationPlaceId
        );

        const duration = this.computeDuration(trip, query.originPlaceId, query.destinationPlaceId);

        return {
          ...trip,
          originCity: originPlace?.city || originStop?.placeId || '-',
          destCity: destPlace?.city || destStop?.placeId || '-',
          departureTime: originStop?.departureTime,
          arrivalTime: destStop?.arrivalTime,
          displayPrice,
          duration,
          availableSeats: this.computeAvailableSeats(trip, query.originPlaceId, query.destinationPlaceId),
        };
      });
    })
  );

  constructor(
    private tripService: TripService,
    private placesService: PlacesService,
    private route: ActivatedRoute,
  ) {
    this.placesService.fetchPlaces().pipe(takeUntil(this.destroy$)).subscribe();
  }

  private computePrice(
    trip: TripType,
    originPlaceId: string | null,
    destPlaceId: string | null
  ): number {
    if (!originPlaceId || !destPlaceId) {
      return trip.segments?.reduce((sum, s) => sum + (s.basePrice || 0), 0) || 0;
    }
    // Check express fares first
    const express = (trip.expressFares || []).find(
      (f) => f.fromPlaceId === originPlaceId && f.toPlaceId === destPlaceId && f.active
    );
    if (express) return express.price;

    // Fallback: sum segment base prices in the chain
    const chainSegments = this.getSegmentChain(trip, originPlaceId, destPlaceId);
    return chainSegments.reduce((sum, s) => sum + (s.basePrice || 0), 0);
  }

  private computeDuration(
    trip: TripType,
    originPlaceId: string | null,
    destPlaceId: string | null
  ): number {
    const chainSegments = this.getSegmentChain(trip, originPlaceId, destPlaceId);
    return chainSegments.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  }

  private computeAvailableSeats(
    trip: TripType,
    originPlaceId: string | null,
    destPlaceId: string | null
  ): number {
    const chainSegments = this.getSegmentChain(trip, originPlaceId, destPlaceId);
    if (chainSegments.length === 0) return 0;
    return Math.min(...chainSegments.map((s) => s.maxSeats - s.bookedSeats));
  }

  private getSegmentChain(
    trip: TripType,
    originPlaceId: string | null,
    destPlaceId: string | null
  ): SegmentType[] {
    if (!originPlaceId || !destPlaceId || !trip.segments) return trip.segments || [];
    const sorted = [...trip.segments].sort((a, b) => a.sequence - b.sequence);
    const startIdx = sorted.findIndex((s) => s.fromPlaceId === originPlaceId);
    const endIdx = sorted.findIndex((s) => s.toPlaceId === destPlaceId);
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return sorted;
    return sorted.slice(startIdx, endIdx + 1);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
