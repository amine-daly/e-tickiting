import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, map, takeUntil } from 'rxjs';

import { SearchCardComponent } from '../../shared/components/search-card/search-card.component';
import { TripService } from '../pages/bus/trip.service';
import { RecentSearchesService } from '../../core/services/recent-searches.service';
import { TripMarketplaceService } from 'src/app/core/services/trip-marketplace.service';
import {
  MarketplaceTrip,
  TripType,
} from '../../core/models/trip.model';

@Component({
  selector: 'home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  popularRoutes$ = this.tripService.allTrips$.pipe(
    map((trips) => this.buildPopularRoutes(trips ?? [])),
  );
  recentSearches$ = this.recentSearchesService.recentSearches$;

  constructor(
    private tripService: TripService,
    private recentSearchesService: RecentSearchesService,
    private tripMarketplaceService: TripMarketplaceService,
  ) {
    this.tripService.getTrips().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildPopularRoutes(trips: TripType[]): MarketplaceTrip[] {
    const routes = this.tripMarketplaceService.expandRoutes(trips);
    const coveredTripIds = new Set(routes.map((route) => route.tripId));

    for (const trip of trips) {
      if (coveredTripIds.has(trip.id)) {
        continue;
      }

      const fallbackRoute = this.toFallbackRoute(trip);
      if (fallbackRoute) {
        routes.push(fallbackRoute);
      }
    }

    return routes.sort((left, right) => {
      const leftDate =
        left.schedule.departureTime || left.schedule.departureDate;
      const rightDate =
        right.schedule.departureTime || right.schedule.departureDate;
      return leftDate.localeCompare(rightDate);
    });
  }

  private toFallbackRoute(trip: TripType): MarketplaceTrip | null {
    const stops = [...(trip.stopSchedule || [])].sort(
      (left, right) => left.sequence - right.sequence,
    );
    const originStop = stops.find((stop) => stop.boardingAllowed) ?? stops[0];
    const destinationStop =
      [...stops].reverse().find((stop) => stop.droppingAllowed) ??
      stops[stops.length - 1];

    if (
      !originStop ||
      !destinationStop ||
      originStop.sequence >= destinationStop.sequence
    ) {
      return null;
    }

    const price =
      trip.expressSegments?.find(
        (segment) =>
          segment.active &&
          segment.fromPlace?.id === originStop.placeId &&
          segment.toPlace?.id === destinationStop.placeId,
      )?.price ??
      (trip.segments || []).reduce(
        (sum, segment) => sum + (segment.basePrice || 0),
        0,
      );

    return {
      key: `${trip.id}:${originStop.placeId}:${destinationStop.placeId}`,
      tripId: trip.id,
      company: {
        id: trip.company?.id ?? null,
        name: trip.company?.name ?? null,
        pictureUrl: null,
      },
      bus: trip.bus,
      route: {
        origin: {
          placeId: originStop.placeId,
          city: originStop.place?.city ?? originStop.placeId,
        },
        destination: {
          placeId: destinationStop.placeId,
          city: destinationStop.place?.city ?? destinationStop.placeId,
        },
      },
      schedule: {
        departureDate: trip.departureDate,
        travelDate: trip.departureDate?.slice(0, 10) ?? null,
        departureTime:
          originStop.departureTime ??
          trip.pickupPoints
            ?.filter(
              (pickup) =>
                pickup.active &&
                pickup.placeId === originStop.placeId &&
                pickup.scheduledDepartureTime,
            )
            .map((pickup) => pickup.scheduledDepartureTime as string)
            .sort()[0] ??
          originStop.arrivalTime,
        arrivalTime: destinationStop.arrivalTime,
        durationMinutes: 0,
      },
      price,
      availableSeats: 0,
      currencyCode: trip.currency?.code ?? 'TND',
    };
  }
}
