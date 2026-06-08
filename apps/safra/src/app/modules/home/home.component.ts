import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, map as rxMap, takeUntil } from 'rxjs';

import { SearchCardComponent } from '../../shared/components/search-card/search-card.component';
import { TripService } from '../pages/bus/trip.service';
import { RecentSearchesService } from '../../core/services/recent-searches.service';
import { TripMarketplaceService } from 'src/app/core/services/trip-marketplace.service';

@Component({
  selector: 'home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  allTrips$ = this.tripService.allTrips$;
  recentSearches$ = this.recentSearchesService.recentSearches$;

  popularRoutes$ = this.allTrips$.pipe(
    rxMap((trips) => this.tripMarketplaceService.expandRoutes(trips)),
  );

  constructor(
    private tripService: TripService,
    private recentSearchesService: RecentSearchesService,
    public readonly tripMarketplaceService: TripMarketplaceService,
  ) {
    this.tripService.getTrips().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
