import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SearchCardComponent } from '../../shared/components/search-card/search-card.component';
import { TripService } from '../pages/bus/trip.service';
import { RecentSearchesService } from '../../core/services/recent-searches.service';
import { PlacesService } from './home.service';
import { map as rxMap } from 'rxjs';

import { TripType } from 'src/app/core/models/trip.model';

type PopularRouteCard = {
  key: string;
  parentTripId: string;
  originPlaceId: string;
  destinationPlaceId: string;
  originLabel: string;
  destinationLabel: string;
  departureDate: string;
  price: number;
  currency: string;
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
    rxMap((trips) => this.expandTripsToExplicitRoutes(trips)),
  );

  constructor(
    private tripService: TripService,
    private recentSearchesService: RecentSearchesService,
    private placesService: PlacesService,
  ) {
    this.placesService.fetchPlaces().subscribe();
    this.tripService.getTrips().subscribe();
  }

  private expandTripsToExplicitRoutes(
    trips: TripType[] | null,
  ): PopularRouteCard[] {
    if (!trips?.length) return [];

    const cards: PopularRouteCard[] = [];

    for (const trip of trips) {
      const stops = trip.stopSchedule || [];
      if (!stops.length) continue;

      const originStop = stops[0];
      const destStop = stops[stops.length - 1];
      const originLabel = originStop.place?.city || originStop.placeId;
      const destLabel = destStop.place?.city || destStop.placeId;

      // Full-route price from segments
      const segPrice = (trip.segments || []).reduce(
        (s, seg) => s + (seg.basePrice || 0),
        0,
      );

      // Main card: origin → destination
      cards.push({
        key: `${trip.id}:full`,
        parentTripId: trip.id,
        originPlaceId: originStop.placeId,
        destinationPlaceId: destStop.placeId,
        originLabel,
        destinationLabel: destLabel,
        departureDate: trip.departureDate,
        price: segPrice,
        currency: trip.currency?.code || '',
      });

      // Express fare cards (sub-routes)
      for (const ef of trip.expressFares || []) {
        if (!ef.active) continue;
        if (
          ef.fromPlaceId === originStop.placeId &&
          ef.toPlaceId === destStop.placeId
        )
          continue; // skip duplicate of main route
        cards.push({
          key: `${trip.id}:ef:${ef.expressId}`,
          parentTripId: trip.id,
          originPlaceId: ef.fromPlaceId,
          destinationPlaceId: ef.toPlaceId,
          originLabel: ef.fromPlace?.city || ef.fromPlaceId,
          destinationLabel: ef.toPlace?.city || ef.toPlaceId,
          departureDate: trip.departureDate,
          price: ef.price,
          currency: trip.currency?.code || '',
        });
      }
    }

    return cards;
  }
}
