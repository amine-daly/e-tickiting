import { Router } from '@angular/router';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, startWith } from 'rxjs/operators';

import { PlacesService } from '../../../modules/home/home.service';
import { TripService } from '../../../modules/pages/bus/trip.service';
import { ToasterService } from '../toast/toaster.service';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
import { PlaceType } from '../../../core/models/place-type';
import { TripSearchParams } from '../../../core/models/trip.model';

@Component({
  selector: 'search-card',
  standalone: true,
  imports: [CommonModule, NgSelectComponent, ReactiveFormsModule],
  templateUrl: './search-card.component.html',
  styleUrls: ['./search-card.component.scss'],
})
export class SearchCardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  placesForm: FormGroup;
  filteredOrigins: PlaceType[] = [];
  filteredDestinations: PlaceType[] = [];

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private tripService: TripService,
    private placesService: PlacesService,
    private toasterService: ToasterService,
    private recentSearchesService: RecentSearchesService
  ) {
    this.placesForm = this.fb.group({
      origin: [null, Validators.required],
      destination: [null, Validators.required],
      date: [''],
    });
  }

  ngOnInit(): void {
    this.placesService.fetchPlaces().pipe(takeUntil(this.destroy$)).subscribe();

    // Combine places, form values, and selectedDestination for reactive filtering
    combineLatest([
      this.placesService.places$,
      this.placesForm.get('origin')!.valueChanges.pipe(startWith(null)),
      this.placesForm.get('destination')!.valueChanges.pipe(startWith(null)),
      this.tripService.selectedDestination$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([places, origin, destination, selected]) => {
        // Initialize form from selected destination (e.g., after refresh)
        if (
          selected &&
          !this.placesForm.get('origin')?.value &&
          !this.placesForm.get('destination')?.value
        ) {
          this.placesForm.patchValue(
            {
              origin: selected.origin || null,
              destination: selected.destination || null,
              date: selected.date || '',
            },
            { emitEvent: false }
          );
        }
        // Filter origins (exclude selected destination)
        const destId = this.placesForm.get('destination')?.value?.id;
        this.filteredOrigins = destId
          ? places.filter((p) => p.id !== destId)
          : places;
        // Filter destinations (exclude selected origin)
        const origId = this.placesForm.get('origin')?.value?.id;
        this.filteredDestinations = origId
          ? places.filter((p) => p.id !== origId)
          : places;
      });
  }

  searchTrips(): void {
    if (this.placesForm.invalid) {
      this.placesForm.markAllAsTouched();
      return;
    }
    const { origin, destination, date } = this.placesForm.value;

    // Add to recent searches
    this.recentSearchesService.addSearch({
      originId: origin.id,
      originLabel: origin.city,
      destinationId: destination.id,
      destinationLabel: destination.city,
      date: date || '',
    });

    const params: TripSearchParams = {
      originId: origin.id,
      destinationId: destination.id,
      ...(date ? { date } : {}),
    };
    this.tripService
      .searchTrips(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (!res || res.length === 0) {
          this.toasterService.error(
            'No trips found for the selected criteria.'
          );
          return;
        }
        this.router.navigate(['/bus-listing'], { queryParams: params });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
