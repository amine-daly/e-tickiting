import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TripService } from '../../core/services/trip.service';
import { PaginateResponse, Trip } from '../../core/models/api';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2 class="mb-3">Results</h2>

    <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
    <div *ngIf="loading" class="text-center py-4">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div *ngIf="!loading && resp?.objects?.length; else none" class="row g-3">
      <div class="col-12" *ngFor="let t of resp!.objects">
        <div class="card">
          <div
            class="card-body d-flex justify-content-between align-items-center"
          >
            <div>
              <div class="fw-semibold">
                {{ t.source.city }} → {{ t.destination.city }}
              </div>
              <div class="text-muted small">
                {{ t.date }} · {{ t.availableSeats }} seats left
              </div>
            </div>
            <div class="text-end">
              <div class="fs-5 fw-bold">{{ t.price | currency }}</div>
              <a
                class="btn btn-outline-primary btn-sm mt-2"
                [routerLink]="['/trip', t.id]"
                >Select seats</a
              >
            </div>
          </div>
        </div>
      </div>
      <div
        class="col-12 d-flex justify-content-between align-items-center mt-2"
      >
        <button
          class="btn btn-outline-secondary"
          (click)="prev()"
          [disabled]="page === 0 || loading"
        >
          Prev
        </button>
        <div class="text-muted small">Page {{ page + 1 }}</div>
        <button
          class="btn btn-outline-secondary"
          (click)="next()"
          [disabled]="resp?.isLast || loading"
        >
          Next
        </button>
      </div>
    </div>
    <ng-template #none
      ><div class="alert alert-info">No results.</div></ng-template
    >
  `,
})
export class ResultsComponent {
  private trips = inject(TripService);
  private router = inject(Router);
  resp: PaginateResponse<Trip> | null = null;
  loading = true;
  error: string | null = null;
  source = '';
  destination = '';
  date = '';
  page = 0;

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.subscribe((params) => {
      this.source = params['source'] ?? '';
      this.destination = params['destination'] ?? '';
      this.date = params['date'] ?? '';
      this.page = Number.isFinite(+params['page'])
        ? parseInt(params['page'], 10)
        : 0;
      this.fetch();
    });
  }

  fetch() {
    this.loading = true;
    this.error = null;
    this.trips
      .search(this.source, this.destination, this.date, this.page)
      .subscribe({
        next: (r) => {
          this.resp = r;
          this.loading = false;
        },
        error: (e) => {
          this.error = e?.error?.message || 'Failed to load results';
          this.loading = false;
        },
      });
  }

  prev() {
    if (this.page === 0) return;
    this.updatePage(this.page - 1);
  }

  next() {
    if (this.resp?.isLast) return;
    this.updatePage(this.page + 1);
  }

  private updatePage(p: number) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        source: this.source,
        destination: this.destination,
        date: this.date,
        page: p,
      },
      queryParamsHandling: 'merge',
    });
  }
}
