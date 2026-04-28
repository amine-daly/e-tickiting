import { Component } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { TripService } from '../trip.service';
import { AmenityEnum } from '../../../../core/models/amenity.enum';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';
import { TripRouteSelection } from '../../../../core/models/trip.model';
import { TripMarketplaceService } from '../../../../core/services/trip-marketplace.service';
import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent, DurationPipe],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent {
  trips$ = combineLatest([
    this.tripService.filtredTrips$,
    this.route.queryParams.pipe(
      map((q) => ({
        originPlaceId: q['originPlaceId'] || null,
        destinationPlaceId: q['destinationPlaceId'] || null,
        date: q['date'] || null,
      })),
    ),
  ]).pipe(
    map(([trips, query]) =>
      this.tripMarketplaceService.mapSearchResults(
        trips,
        query as TripRouteSelection,
      ),
    ),
  );

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
    private tripMarketplaceService: TripMarketplaceService,
  ) {}

  // Public mapping used by the template to render amenity icons and labels
  amenityMap: Record<AmenityEnum, { icon: string; label: string }> = {
    [AmenityEnum.WIFI]: { icon: 'bi-wifi', label: 'WiFi' },
    [AmenityEnum.POWER_OUTLET]: { icon: 'bi-plug', label: 'Power' },
    [AmenityEnum.TV]: { icon: 'bi-tv', label: 'TV' },
    [AmenityEnum.SNACKS]: { icon: 'bi-cup-hot', label: 'Snacks' },
    [AmenityEnum.AC]: { icon: 'bi-snow', label: 'AC' },
    [AmenityEnum.TOILET]: { icon: 'bi-person', label: 'Toilet' },
    [AmenityEnum.LUGGAGE]: { icon: 'bi-bag', label: 'Luggage' },
    [AmenityEnum.USB]: { icon: 'bi-usb', label: 'USB' },
  };
}
