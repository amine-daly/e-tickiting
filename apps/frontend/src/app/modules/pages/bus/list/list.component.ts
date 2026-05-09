import { Component } from '@angular/core';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { TripService } from '../trip.service';
import { AmenityEnum } from '../../../../core/models/amenity.enum';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';
import {
  MarketplaceProjection,
  TripType,
} from '../../../../core/models/trip.model';
import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';

type TripWithMarketplace = TripType & { marketplace: MarketplaceProjection };

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent, DurationPipe],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent {
  trips$ = this.tripService.filtredTrips$.pipe(
    map((trips) =>
      trips.filter((trip): trip is TripWithMarketplace => !!trip.marketplace),
    ),
  );

  constructor(private tripService: TripService) {}

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
