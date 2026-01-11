import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SearchCardComponent } from '../../shared/components/search-card/search-card.component';
import { TripService } from '../pages/bus/trip.service';
import { RecentSearchesService } from '../../core/services/recent-searches.service';
import { map as rxMap } from 'rxjs';
import {
  isEmpty,
  flatMap,
  get,
  sortBy,
  map,
  compact,
  sumBy,
  head,
  forEach,
  slice,
  groupBy,
  maxBy,
} from 'lodash';

import { TripType } from 'src/app/core/models/trip.model';

type PopularRouteCard = {
  key: string;
  parentTripId: string;
  originLabel: string;
  destinationLabel: string;
  departureDate: string;
  price: number;
  isOriginal: boolean;
};

@Component({
  selector: 'home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  allTrips$ = this.tripService.allTrips$;
  recentSearches$ = this.recentSearchesService.recentSearches$;

  explicitTrips$ = this.allTrips$.pipe(
    rxMap((trips) => this.expandTripsToExplicitRoutes(trips))
  );

  constructor(
    private tripService: TripService,
    private recentSearchesService: RecentSearchesService
  ) {
    this.tripService.getTrips().subscribe();
    this.explicitTrips$.subscribe((trips) => {
      console.log('Expanded trips:', trips);
    });
  }

  private expandTripsToExplicitRoutes(
    trips: TripType[] | null
  ): PopularRouteCard[] {
    if (isEmpty(trips)) return [];

    return flatMap(trips, (trip) => {
      // Safe extraction using lodash get or optional chaining
      const originId = get(trip, 'originId');
      const destinationId = get(trip, 'destinationId');

      const originLabel = get(trip, 'origin.city') || originId || '-';
      const destinationLabel =
        get(trip, 'destination.city') || destinationId || '-';

      const tripTotalPrice = this.parseMoney(get(trip, 'totalPrice'));

      // Sort stops safely
      const rawStops = sortBy(trip?.stops || [], ['rank']);

      // Original trip card
      const originalCard: PopularRouteCard = {
        key: `${trip.id}:original`,
        parentTripId: trip.id,
        originLabel,
        destinationLabel,
        departureDate: trip?.departureDate as string,
        price: tripTotalPrice,
        isOriginal: true,
      };

      // Map stops to points ensuring valid data
      const stopPoints = compact(
        map(rawStops, (s) => {
          const id = s?.placeId ?? s?.destinationId;
          const label = s?.place?.city || id;
          const fare = this.parseMoney(s?.fare);
          return id && label ? { id, label, fare } : null;
        })
      );

      // Construct ordered list of all points: Origin -> Stops -> Destination
      const points = compact([
        originId ? { id: originId, label: originLabel } : null,
        ...stopPoints,
        destinationId ? { id: destinationId, label: destinationLabel } : null,
      ]);

      if (points.length < 2) return [originalCard];

      // Calculate fares
      const totalStopsFare = sumBy(stopPoints, 'fare');
      const lastLegPrice = Math.max(0, tripTotalPrice - totalStopsFare);

      // Generate legs: origin -> stop(i) and origin -> destination
      const originPoint = head(points);
      const legs: PopularRouteCard[] = [];

      if (originPoint?.id) {
        // Iterate over all subsequent points to form legs from origin
        forEach(slice(points, 1), (to, index) => {
          if (!to?.id || originPoint.id === to.id) return;

          // If last point (destination), use remaining price; otherwise use stop fare
          const isFinal = index === points.length - 2; // -2 because we sliced 1 off, so length is N-1
          const segmentPrice = isFinal
            ? lastLegPrice
            : this.parseMoney(to.fare);

          legs.push({
            key: `${trip.id}:leg:${index + 1}`, // +1 to offset origin
            parentTripId: trip.id,
            originLabel: originPoint.label,
            destinationLabel: to.label,
            departureDate: trip?.departureDate as string,
            price: segmentPrice,
            isOriginal: false,
          });
        });
      }

      // Merge and Dedup: Group by Origin-Dest, take max price
      const grouped = groupBy(
        [originalCard, ...legs],
        (c) => `${c.parentTripId}::${c.originLabel}::${c.destinationLabel}`
      );
      return compact(
        map(grouped, (group) => maxBy(group, 'price') as PopularRouteCard)
      );
    });
  }

  private parseMoney(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    // Backend sometimes returns { source, parsedValue }
    if (typeof value === 'object') {
      const pv = (value as any)?.parsedValue;
      if (typeof pv === 'number') return Number.isFinite(pv) ? pv : 0;
      if (typeof pv === 'string') {
        const n = Number(pv);
        return Number.isFinite(n) ? n : 0;
      }
    }
    return 0;
  }
}
