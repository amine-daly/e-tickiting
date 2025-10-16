import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { PlaceService, Place } from '../../core/services/place.service';

interface PopularDestination {
  name: string;
  description: string;
  image: string;
  price: number;
  rating: number;
  trips: number;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  form: FormGroup;
  places: Place[] = [];
  popularDestinations: PopularDestination[] = [
    {
      name: 'Paris, France',
      description:
        'Experience the City of Light with its iconic landmarks and culture',
      image:
        'https://images.unsplash.com/photo-1502602898536-47ad22581b52?w=400&h=300&fit=crop',
      price: 299,
      rating: 4.8,
      trips: 156,
    },
    {
      name: 'Tokyo, Japan',
      description: 'Discover the perfect blend of traditional and modern Japan',
      image:
        'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
      price: 599,
      rating: 4.9,
      trips: 98,
    },
    {
      name: 'New York, USA',
      description: 'The city that never sleeps awaits your adventure',
      image:
        'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&h=300&fit=crop',
      price: 449,
      rating: 4.7,
      trips: 203,
    },
  ];

  private router = inject(Router);
  private fb = inject(FormBuilder);
  private placeService = inject(PlaceService);

  constructor() {
    this.form = this.fb.group({
      sourceId: ['', Validators.required],
      destinationId: ['', Validators.required],
      date: ['', Validators.required],
      passengers: [1, Validators.required],
    });

    this.placeService.list('', 0, 200).subscribe((res) => {
      this.places = res.objects;
    });
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const params = new URLSearchParams({
      sourceId: v.sourceId,
      destinationId: v.destinationId,
      date: v.date,
      passengers: String(v.passengers),
    });
    this.router.navigateByUrl('/results?' + params.toString());
  }
}
