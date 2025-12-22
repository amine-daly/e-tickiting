import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SearchCardComponent } from '../../../../shared/components/search-card/search-card.component';
import { TripService } from '../trip.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-bus-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class BusListComponent {
  private unsubscribeAll: Subject<void> = new Subject<void>();

  trips$ = this.tripService.filtredTrips$;

  constructor(private tripService: TripService) {}

  ngOnDestroy(): void {
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
  }
}
