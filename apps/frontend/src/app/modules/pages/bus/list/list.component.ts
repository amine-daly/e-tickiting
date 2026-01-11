import { Component } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';
import { TripService } from '../trip.service';
import { Subject, takeUntil, combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent {
  private unsubscribeAll: Subject<void> = new Subject<void>();

  // trips$ emits trips annotated with `displayPrice` computed for the
  // currently selected destination query param.
  trips$ = combineLatest([
    this.tripService.filtredTrips$,
    this.route.queryParams.pipe(map((q) => q['destinationId'] || null)),
  ]).pipe(
    map(([trips, destinationId]) => {
      return (trips || []).map((trip: any) => ({
        ...trip,
        displayPrice: this.computeDisplayPrice(trip, destinationId),
      }));
    })
  );

  constructor(
    private tripService: TripService,
    private route: ActivatedRoute
  ) {}

  private computeDisplayPrice(trip: any, destinationId: string | null): number {
    const totalPrice = Number(trip.totalPrice) || 0;
    if (!destinationId) return totalPrice;
    if (destinationId === trip.destinationId) return totalPrice;

    const stops = Array.isArray(trip.stops) ? [...trip.stops] : [];
    stops.sort((a: any, b: any) => (a?.rank ?? 0) - (b?.rank ?? 0));

    let sum = 0;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const fare = Number(s?.fare) || 0;
      sum += fare;
      if (s?.placeId === destinationId) {
        return sum;
      }
    }

    return totalPrice;
  }

  ngOnDestroy(): void {
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
  }
}
