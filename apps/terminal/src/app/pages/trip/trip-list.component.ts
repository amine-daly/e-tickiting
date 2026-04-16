import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  NgbDropdownModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { Subject, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';

import { TripType, TripStatusEnum } from '../../core/models/trip.model';
import {
  TripFilterInput,
  TripSortBy,
  TripSortOrder,
} from '../../core/models/trip-filter-input.model';
import { TripService } from './trip.service';
import { AlertService } from '../../core/services/alert.service';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NgbDropdownModule,
    NgbTooltipModule,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    NgSelectComponent,
    TranslateModule,
    PaginationComponent,
    ToolbarComponent,
  ],
  selector: 'app-trip-list',
  templateUrl: './trip-list.component.html',
  styleUrls: ['./trip-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  trips$ = this.tripService.trips$;
  loading$ = this.tripService.loading$;
  pagination$ = this.tripService.pagination$;

  page = 1;
  pageSize = this.tripService.pageLimit;

  // Filters
  filterStatus: TripStatusEnum | null = null;
  filterSearch = '';
  sortBy: TripSortBy = 'createdAt';
  sortOrder: TripSortOrder = 'desc';

  statusUpdating: Record<string, boolean> = {};

  statusFilterOptions: Array<{
    value: TripStatusEnum | null;
    label: string;
  }> = [
    { value: null, label: this.t('TRIPS.FILTERS.ALL') },
    {
      value: TripStatusEnum.SCHEDULED,
      label: this.t('TRIPS.STATUS.SCHEDULED'),
    },
    { value: TripStatusEnum.ACTIVE, label: this.t('TRIPS.STATUS.ACTIVE') },
    {
      value: TripStatusEnum.COMPLETED,
      label: this.t('TRIPS.STATUS.COMPLETED'),
    },
    {
      value: TripStatusEnum.CANCELLED,
      label: this.t('TRIPS.STATUS.CANCELLED'),
    },
  ];

  sortByOptions: Array<{ value: TripSortBy; label: string }> = [
    { value: 'createdAt', label: this.t('TRIPS.SORT.CREATED_AT') },
    {
      value: 'departureDate',
      label: this.t('TRIPS.FIELDS.DEPARTURE_DATE'),
    },
  ];

  sortOrderOptions: Array<{ value: TripSortOrder; label: string }> = [
    { value: 'desc', label: this.t('TRIPS.SORT.DESC') },
    { value: 'asc', label: this.t('TRIPS.SORT.ASC') },
  ];

  statusLabelMap: Record<TripStatusEnum, string> = {
    [TripStatusEnum.SCHEDULED]: 'TRIPS.STATUS.SCHEDULED',
    [TripStatusEnum.ACTIVE]: 'TRIPS.STATUS.ACTIVE',
    [TripStatusEnum.COMPLETED]: 'TRIPS.STATUS.COMPLETED',
    [TripStatusEnum.CANCELLED]: 'TRIPS.STATUS.CANCELLED',
  };

  statusBadgeClass: Record<TripStatusEnum, string> = {
    [TripStatusEnum.SCHEDULED]: 'badge-light-primary',
    [TripStatusEnum.ACTIVE]: 'badge-light-success',
    [TripStatusEnum.COMPLETED]: 'badge-light-info',
    [TripStatusEnum.CANCELLED]: 'badge-light-danger',
  };

  constructor(
    private tripService: TripService,
    private alert: AlertService,
    private translate: TranslateService,
    private pageInfo: PageInfoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.pageInfo.setTitle(this.t('TRIPS.TITLE'));
    this.loadTrips(1);
  }

  // ─── DATA LOADING ───────────────────────────────────────
  loadTrips(page: number): void {
    this.page = page;
    this.tripService.pageIndex = page - 1;
    const filter: TripFilterInput = {};
    if (this.filterStatus) {
      filter.status = this.filterStatus;
    }
    if (this.filterSearch.trim()) {
      filter.searchTerm = this.filterSearch.trim();
    }
    filter.sortBy = this.sortBy;
    filter.order = this.sortOrder;
    const sub = this.tripService.list(filter).subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.alert.error(this.t('TRIPS.MESSAGES.LOAD_ERROR')),
    });
    this.subscriptions.add(sub);
  }

  onPageChange(page: number): void {
    this.loadTrips(page);
  }

  applyFilters(): void {
    this.loadTrips(1);
  }

  clearFilters(): void {
    this.filterStatus = null;
    this.filterSearch = '';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.loadTrips(1);
  }

  // ─── ROUTE PREVIEW ─────────────────────────────────────
  routePreview(trip: TripType): string {
    if (!trip?.stopSchedule?.length) return '-';
    const stops = [...trip.stopSchedule].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const first = stops[0]?.place?.city || stops[0]?.placeId || '-';
    const last =
      stops[stops.length - 1]?.place?.city ||
      stops[stops.length - 1]?.placeId ||
      '-';
    if (first === last) return first;
    return `${first} → ${last}`;
  }

  // ─── STATUS ACTION ─────────────────────────────────────
  async changeStatus(
    trip: TripType,
    nextStatus: TripStatusEnum,
  ): Promise<void> {
    if (!trip || trip.status === nextStatus) return;
    const statusLabel = this.t(this.statusLabelMap[nextStatus]);

    let confirmKey = 'TRIPS.MESSAGES.STATUS_CONFIRM_TEXT';
    if (nextStatus === TripStatusEnum.ACTIVE)
      confirmKey = 'TRIPS.MESSAGES.PUBLISH_CONFIRM';
    else if (nextStatus === TripStatusEnum.CANCELLED)
      confirmKey = 'TRIPS.MESSAGES.CANCEL_CONFIRM';

    const result = await this.alert.confirm(
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t(confirmKey, { status: statusLabel }),
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;

    this.statusUpdating[trip.id] = true;
    this.cdr.markForCheck();

    const sub = this.tripService
      .updateStatus(trip.id, nextStatus)
      .pipe(
        finalize(() => {
          this.statusUpdating[trip.id] = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.alert.success(this.t('TRIPS.MESSAGES.STATUS_UPDATED')),
        error: () =>
          this.alert.error(this.t('TRIPS.MESSAGES.STATUS_UPDATE_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  getAvailableTransitions(
    trip: TripType,
  ): Array<{ status: TripStatusEnum; labelKey: string }> {
    switch (trip.status) {
      case TripStatusEnum.SCHEDULED:
        return [
          { status: TripStatusEnum.ACTIVE, labelKey: 'TRIPS.ACTIONS.PUBLISH' },
          {
            status: TripStatusEnum.CANCELLED,
            labelKey: 'TRIPS.ACTIONS.CANCEL',
          },
        ];
      case TripStatusEnum.ACTIVE:
        return [
          {
            status: TripStatusEnum.COMPLETED,
            labelKey: 'TRIPS.ACTIONS.COMPLETE',
          },
          {
            status: TripStatusEnum.CANCELLED,
            labelKey: 'TRIPS.ACTIONS.EMERGENCY_CANCEL',
          },
        ];
      default:
        return [];
    }
  }

  // ─── DELETE ────────────────────────────────────────────
  async deleteTrip(trip: TripType): Promise<void> {
    const result = await this.alert.warning(
      this.t('TRIPS.DELETE_CONFIRM'),
      this.t('COMMON.CONFIRM.DELETE_TEXT'),
    );
    if (!result.isConfirmed) return;

    const sub = this.tripService.delete(trip.id).subscribe({
      next: () => {
        this.alert.success(this.t('TRIPS.MESSAGES.DELETED'));
        this.loadTrips(this.page);
      },
      error: () => this.alert.error(this.t('TRIPS.MESSAGES.DELETE_ERROR')),
    });
    this.subscriptions.add(sub);
  }

  canDelete(trip: TripType): boolean {
    return trip.status === TripStatusEnum.SCHEDULED;
  }

  // ─── HELPERS ────────────────────────────────────────────
  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
  }
}
