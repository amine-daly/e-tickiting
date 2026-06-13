import { Component, OnInit } from '@angular/core';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  RouterLink,
} from '@angular/router';

import { TripService } from '../trip.service';
import { AmenityEnum } from '../../../../core/models/amenity.enum';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';
import {
  TripSearchParams,
  TripStatusEnum,
  TripWithMarketplace,
} from '../../../../core/models/trip.model';
import { PlacesService } from '../../../home/home.service';
import { LOGO_BASE } from '../../../../environments/environment';
import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent, DurationPipe],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent {
  private destroy$ = new Subject<void>();

  isLoading = true;
  hasError = false;
  shimmerItems = Array.from({ length: 4 });
  shimmerTags = Array.from({ length: 3 });
  trips$ = this.tripService.filtredTrips$;
  logoBase = LOGO_BASE;
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

  constructor(
    private tripService: TripService,
    private placesService: PlacesService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        takeUntil(this.destroy$),
        map((params) => this.buildSearchParams(params)),
        tap(() => {
          this.isLoading = true;
          this.hasError = false;
        }),
        switchMap((params) => {
          return this.syncSelectedDestination(params).pipe(
            switchMap(() => this.tripService.searchTrips(params)),
            tap(() => (this.isLoading = false)),
            catchError(() => {
              this.hasError = true;
              return of([] as TripWithMarketplace[]);
            }),
          );
        }),
      )
      .subscribe();
  }

  private buildSearchParams(queryParams: ParamMap): TripSearchParams {
    const originPlaceId = queryParams.get('originPlaceId') || undefined;
    const destinationPlaceId =
      queryParams.get('destinationPlaceId') || undefined;
    const date = queryParams.get('date') || undefined;
    return {
      status: TripStatusEnum.ACTIVE,
      originPlaceId,
      destinationPlaceId,
      ...(date ? { date } : {}),
    };
  }

  private syncSelectedDestination(params: TripSearchParams): Observable<void> {
    if (!params.originPlaceId || !params.destinationPlaceId) {
      this.tripService.selectedDestination$ = null;
      return of(void 0);
    }
    return combineLatest([
      this.placesService.getPlaceById(params.originPlaceId),
      this.placesService.getPlaceById(params.destinationPlaceId),
    ]).pipe(
      map(([origin, destination]) => {
        this.tripService.selectedDestination$ = {
          origin,
          destination,
          ...(params.date ? { date: params.date } : {}),
        };
      }),
      map(() => void 0),
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
