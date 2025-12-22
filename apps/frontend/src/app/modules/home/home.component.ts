import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SearchCardComponent } from '../../shared/components/search-card/search-card.component';
import { TripService } from '../pages/bus/trip.service';

@Component({
  selector: 'home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  allTrips$ = this.tripService.allTrips$;

  constructor(private tripService: TripService) {
    this.tripService.getTrips().subscribe();
  }
  // Static showcase only for now – real bindings will be reintroduced later.
}
