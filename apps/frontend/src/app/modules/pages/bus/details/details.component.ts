import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { TripService } from '../trip.service';
import {
  DropoffPointType,
  PickupPointType,
  StopType,
  TripRouteSelection,
  TripType,
} from '../../../../core/models/trip.model';
import { Picture } from '../../../../core/models/shared.model';
import AmenityEnum from '../../../../core/models/amenity.enum';
import {
  AMENITY_MAP,
  formatAmenityName,
} from '../../../../core/utils/amenity-map';

type RouteStopViewModel = StopType & { city: string };

@Component({
  selector: 'app-bus-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
})
export class BusDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private requestedDefaultRoute = false;

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
  journeyDepartureTime: string | null = null;
  journeyArrivalTime: string | null = null;

  activePickups: PickupPointType[] = [];
  activeDropoffs: DropoffPointType[] = [];
  routeStops: RouteStopViewModel[] = [];
  busPictureUrls: string[] = [];

  // Reuse shared amenity map
  amenityMap = AMENITY_MAP;

  // Fallback formatter used by the template when amenity label is missing
  formatAmenity(amenity?: string | null): string {
    if (!amenity) return '';
    return (
      this.amenityMap[amenity as AmenityEnum]?.label ||
      formatAmenityName(amenity)
    );
  }

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

    this.loadTrip(tripId);
  }

  private loadTrip(tripId: string): void {
    const routeSelection: TripRouteSelection = {
      originPlaceId: this.originPlaceId,
      destinationPlaceId: this.destPlaceId,
      date: this.travelDate,
    };

    this.tripService
      .getTripById(tripId, routeSelection)
      .pipe(takeUntil(this.destroy$))
      .subscribe((trip) => {
        console.log('🚀 ~ BusDetailsComponent ~ loadTrip ~ trip:', trip);
        const defaultRoute = this.resolveDefaultRouteSelection(trip);

        if (
          !this.requestedDefaultRoute &&
          defaultRoute &&
          (!this.originPlaceId || !this.destPlaceId)
        ) {
          this.requestedDefaultRoute = true;
          this.originPlaceId = this.originPlaceId || defaultRoute.originPlaceId;
          this.destPlaceId =
            this.destPlaceId || defaultRoute.destinationPlaceId;
          this.travelDate = this.travelDate || defaultRoute.date || null;
          this.loadTrip(tripId);
          return;
        }

        this.trip = trip;
        this.syncViewState(trip);
      });
  }

  selectPickup(point: PickupPointType): void {
    this.selectedPickup = point;
  }

  selectDropoff(point: DropoffPointType): void {
    this.selectedDropoff = point;
  }

  private syncViewState(trip: TripType): void {
    this.routeStops = this.buildRouteStops(trip);
    this.busPictureUrls = this.resolveBusPictureUrls(trip);
    this.activePickups = this.filterActivePickups(trip.pickupPoints || []);
    this.activeDropoffs = this.filterActiveDropoffs(trip.dropoffPoints || []);
    this.selectedPickup = this.activePickups[0] || null;
    this.selectedDropoff = this.activeDropoffs[0] || null;
    this.displayPrice = trip.marketplace?.price || 0;
    this.duration = trip.marketplace?.schedule?.durationMinutes || 0;
    this.journeyDepartureTime =
      trip.marketplace?.schedule?.departureTime ||
      this.routeStops[0]?.departureTime ||
      null;
    this.journeyArrivalTime =
      trip.marketplace?.schedule?.arrivalTime ||
      this.routeStops[this.routeStops.length - 1]?.arrivalTime ||
      null;
    this.resolveLabels(trip);
  }

  private resolveLabels(trip: TripType): void {
    this.originCity =
      trip.marketplace?.route?.origin?.city || this.routeStops[0]?.city || '';
    this.destCity =
      trip.marketplace?.route?.destination?.city ||
      this.routeStops[this.routeStops.length - 1]?.city ||
      '';
  }

  private buildRouteStops(trip: TripType): RouteStopViewModel[] {
    const sortedStops = [...(trip.stopSchedule || [])].sort(
      (a, b) => a.sequence - b.sequence,
    );

    if (!sortedStops.length) {
      return [];
    }

    const startIdx = this.originPlaceId
      ? sortedStops.findIndex((stop) => stop.placeId === this.originPlaceId)
      : 0;
    const endIdx = this.destPlaceId
      ? this.findLastStopIndex(sortedStops, this.destPlaceId)
      : sortedStops.length - 1;

    const routeStops =
      startIdx >= 0 && endIdx >= startIdx
        ? sortedStops.slice(startIdx, endIdx + 1)
        : sortedStops;

    return routeStops.map((stop) => ({
      ...stop,
      city: stop.place?.city || stop.placeId,
    }));
  }

  private findLastStopIndex(stops: StopType[], placeId: string): number {
    for (let index = stops.length - 1; index >= 0; index -= 1) {
      if (stops[index].placeId === placeId) {
        return index;
      }
    }

    return -1;
  }

  private filterActivePickups(points: PickupPointType[]): PickupPointType[] {
    const activePoints = points.filter((point) => point.active);

    if (!this.originPlaceId) {
      return activePoints;
    }

    const matchingPoints = activePoints.filter(
      (point) => point.placeId === this.originPlaceId,
    );

    return matchingPoints.length ? matchingPoints : activePoints;
  }

  private filterActiveDropoffs(points: DropoffPointType[]): DropoffPointType[] {
    const activePoints = points.filter((point) => point.active);

    if (!this.destPlaceId) {
      return activePoints;
    }

    const matchingPoints = activePoints.filter(
      (point) => point.placeId === this.destPlaceId,
    );

    return matchingPoints.length ? matchingPoints : activePoints;
  }

  private resolveBusPictureUrls(trip: TripType): string[] {
    return (trip.bus?.media?.pictures || [])
      .map((picture) => this.toPictureUrl(picture))
      .filter((pictureUrl): pictureUrl is string => !!pictureUrl);
  }

  private toPictureUrl(picture: Picture | null | undefined): string | null {
    if (!picture?.baseUrl || !picture?.path) {
      return null;
    }

    const baseUrl = picture.baseUrl.replace(/\/+$/, '');
    const path = picture.path.replace(/^\/+/, '');

    return `${baseUrl}/${path}`;
  }

  private resolveDefaultRouteSelection(
    trip: TripType,
  ): TripRouteSelection | null {
    const commercialStops = [...(trip.stopSchedule || [])]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((stop) => stop.boardingAllowed || stop.droppingAllowed);

    if (commercialStops.length < 2) {
      return null;
    }

    const originStop = commercialStops.find((stop) => stop.boardingAllowed);
    const destinationStop = [...commercialStops]
      .reverse()
      .find((stop) => stop.droppingAllowed);

    if (
      !originStop ||
      !destinationStop ||
      originStop.sequence >= destinationStop.sequence
    ) {
      return null;
    }

    return {
      originPlaceId: originStop.placeId,
      destinationPlaceId: destinationStop.placeId,
      date: trip.departureDate?.slice(0, 10) || null,
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
