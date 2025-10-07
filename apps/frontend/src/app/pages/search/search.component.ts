import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
  imports: [CommonModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
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

  constructor(private router: Router) {}

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  go(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const q = new URLSearchParams(data as any).toString();
    this.router.navigateByUrl('/results?' + q);
  }
}
