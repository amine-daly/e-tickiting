import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, forkJoin, of, switchMap, tap } from 'rxjs';
import { TripService } from './trip.service';
import {
  TripSearchParams,
  TripStatusEnum,
  TripType,
} from '../../../core/models/trip.model';
import { PlacesService } from '../../home/home.service';

@Injectable({ providedIn: 'root' })
export class TripResolver implements Resolve<TripType[]> {
  constructor(
    private tripService: TripService,
    private placesService: PlacesService,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<TripType[]> {
    const params: TripSearchParams = {
      status: TripStatusEnum.ACTIVE,
      originPlaceId: route.queryParamMap.get('originPlaceId') || undefined,
      destinationPlaceId:
        route.queryParamMap.get('destinationPlaceId') || undefined,
      ...(route.queryParamMap.get('date')
        ? { date: route.queryParamMap.get('date')! }
        : {}),
    };

    const originId = params.originPlaceId;
    const destId = params.destinationPlaceId;
    const selectedDestination$ =
      originId && destId
        ? forkJoin({
            origin: this.placesService.getPlaceById(originId),
            destination: this.placesService.getPlaceById(destId),
          }).pipe(
            tap(({ origin, destination }) => {
              this.tripService.selectedDestination$ = {
                origin,
                destination,
                ...(params.date ? { date: params.date } : {}),
              };
            }),
          )
        : of(null).pipe(
            tap(() => {
              this.tripService.selectedDestination$ = null;
            }),
          );

    return selectedDestination$.pipe(
      switchMap(() => this.tripService.searchTrips(params)),
    );
  }
}
