import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeatService } from '../../core/services/seat.service';
import { TripService } from '../../core/services/trip.service';
import { Seat, Trip } from '../../core/models/api';

type SeatKey = string; // `${row}-${col}`

@Component({
  selector: 'app-trip-seats',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-0">Select seats</h2>
        <div class="text-muted" *ngIf="trip">
          {{ trip!.source.city }} → {{ trip!.destination.city }} ·
          {{ trip!.date }}
        </div>
      </div>
      <a routerLink="/search" class="btn btn-link">Back to search</a>
    </div>

    <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
    <div *ngIf="info" class="alert alert-success">{{ info }}</div>

    <div *ngIf="loading" class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div *ngIf="!loading">
      <div class="seat-legend mb-2 small text-muted">
        <span class="badge bg-success me-2">Available</span>
        <span class="badge bg-secondary me-2">Reserved</span>
        <span class="badge bg-dark me-2">Blocked</span>
        <span class="badge bg-primary">Selected</span>
      </div>

      <div
        class="seat-grid mb-3"
        [style.gridTemplateColumns]="gridTemplateCols"
      >
        <ng-container *ngFor="let r of rows">
          <ng-container *ngFor="let c of cols">
            <button
              type="button"
              class="btn seat"
              [class.btn-outline-success]="
                seatState(r, c) === 'AVAILABLE' && !isSelected(r, c)
              "
              [class.btn-success]="
                seatState(r, c) === 'AVAILABLE' && isSelected(r, c)
              "
              [class.btn-secondary]="seatState(r, c) === 'RESERVED'"
              [class.btn-dark]="seatState(r, c) === 'BLOCKED'"
              [disabled]="seatState(r, c) !== 'AVAILABLE'"
              (click)="toggle(r, c)"
            >
              {{ r }}-{{ c }}
            </button>
          </ng-container>
        </ng-container>
      </div>

      <div class="d-flex justify-content-between align-items-center">
        <div class="text-muted">Selected: {{ selectedCount }}</div>
        <button
          class="btn btn-primary"
          [disabled]="selectedCount === 0 || reserving"
          (click)="reserve()"
        >
          {{ reserving ? 'Reserving…' : 'Reserve seats' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .seat-grid {
        display: grid;
        gap: 0.5rem;
      }
      .seat {
        min-width: 3.2rem;
        min-height: 3rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class TripSeatsComponent {
  private route = inject(ActivatedRoute);
  private seatsApi = inject(SeatService);
  private tripsApi = inject(TripService);

  tripId!: string;
  trip: Trip | null = null;
  seats: Seat[] = [];
  seatIndex = new Map<SeatKey, Seat>();
  rows: number[] = [];
  cols: number[] = [];
  gridTemplateCols = '';
  selected = new Set<SeatKey>();

  loading = true;
  reserving = false;
  error: string | null = null;
  info: string | null = null;

  constructor() {
    this.route.paramMap.subscribe((p) => {
      this.tripId = p.get('id')!;
      this.fetch();
      this.tripsApi
        .get(this.tripId)
        .subscribe({ next: (t) => (this.trip = t), error: () => {} });
    });
  }

  private fetch() {
    this.loading = true;
    this.error = null;
    this.seatsApi.getMap(this.tripId).subscribe({
      next: (r) => {
        this.seats = r.seats;
        this.rebuildIndex();
        this.loading = false;
      },
      error: (e) => {
        this.loading = false;
        this.error = e?.error?.message || 'Failed to load seats';
      },
    });
  }

  private rebuildIndex() {
    this.seatIndex.clear();
    let maxR = 0,
      maxC = 0;
    for (const s of this.seats) {
      const key = this.key(s.row, s.col);
      this.seatIndex.set(key, s);
      if (s.row > maxR) maxR = s.row;
      if (s.col > maxC) maxC = s.col;
    }
    this.rows = Array.from({ length: maxR + 1 }, (_, i) => i);
    this.cols = Array.from({ length: maxC + 1 }, (_, i) => i);
    this.gridTemplateCols = `repeat(${this.cols.length}, minmax(3.2rem, auto))`;
    this.selected.clear();
  }

  private key(r: number, c: number): SeatKey {
    return `${r}-${c}`;
  }

  seatState(r: number, c: number) {
    const s = this.seatIndex.get(this.key(r, c));
    return s?.state ?? 'BLOCKED';
  }

  isSelected(r: number, c: number) {
    return this.selected.has(this.key(r, c));
  }

  toggle(r: number, c: number) {
    if (this.seatState(r, c) !== 'AVAILABLE') return;
    const k = this.key(r, c);
    if (this.selected.has(k)) this.selected.delete(k);
    else this.selected.add(k);
  }

  get selectedCount() {
    return this.selected.size;
  }

  reserve() {
    if (this.selected.size === 0) return;
    this.reserving = true;
    this.error = null;
    this.info = null;
    const seats = Array.from(this.selected).map((k) => {
      const [row, col] = k.split('-').map((x) => +x);
      return { row, col };
    });
    this.seatsApi.reserve(this.tripId, { seats }).subscribe({
      next: () => {
        this.reserving = false;
        this.info = 'Seats reserved successfully';
        this.fetch();
      },
      error: (e) => {
        this.reserving = false;
        this.error = e?.error?.message || 'Reservation failed';
      },
    });
  }
}
