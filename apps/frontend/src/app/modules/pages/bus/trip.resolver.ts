import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { TripService } from './trip.service';
import {
  TripSearchParams,
  TripType,
} from '../../../core/models/trip.model';
import { PlacesService } from '../../home/home.service';

@Injectable({ providedIn: 'root' })
export class TripResolver implements Resolve<TripType[]> {
  constructor(
    private tripService: TripService,
    private placesService: PlacesService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<TripType[]> {
    const params: TripSearchParams = {
      originPlaceId: route.queryParamMap.get('originPlaceId') || undefined,
      destinationPlaceId: route.queryParamMap.get('destinationPlaceId') || undefined,
      ...(route.queryParamMap.get('date')
        ? { date: route.queryParamMap.get('date')! }
        : {}),
    };

    const originId = params.originPlaceId;
    const destId = params.destinationPlaceId;

    if (originId && destId) {
      forkJoin({
        origin: this.placesService.getPlaceById(originId),
        destination: this.placesService.getPlaceById(destId),
      }).subscribe(({ origin, destination }) => {
        this.tripService.selectedDestination$ = {
          origin,
          destination,
          ...(params.date ? { date: params.date } : {}),
        };
      });
    }

    return this.tripService.searchTrips(params);
  }
}
