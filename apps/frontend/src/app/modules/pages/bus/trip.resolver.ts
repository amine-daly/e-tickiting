import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { TripService } from './trip.service';
import {
  TripSearchParams,
  TripType,
  TripDestinationForm,
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
      originId: route.queryParamMap.get('originId') || '',
      destinationId: route.queryParamMap.get('destinationId') || '',
      ...(route.queryParamMap.get('date')
        ? { date: route.queryParamMap.get('date') }
        : {}),
    };

    // Fetch both places by ID, then assign to selectedDestination$
    forkJoin({
      origin: this.placesService.getPlaceById(params.originId),
      destination: this.placesService.getPlaceById(params.destinationId),
    }).subscribe(({ origin, destination }) => {
      this.tripService.selectedDestination$ = {
        origin,
        destination,
        ...(params.date ? { date: params.date } : {}),
      };
    });

    return this.tripService.searchTrips(params);
  }
}
