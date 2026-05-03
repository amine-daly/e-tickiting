import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import {
  TripType,
  StopType,
  SegmentType,
  TripStatusEnum,
  ExpressSegmentType,
  PickupPointType,
  DropoffPointType,
} from '../../../core/models/trip.model';
import { TripService } from '../trip.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { DurationPipe } from 'src/app/shared/pipes/duration.pipe';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DurationPipe,
    TranslateModule,
    NgbTooltipModule,
    ToolbarComponent,
  ],
  selector: 'app-trip-info',
  templateUrl: './trip-info.component.html',
  styleUrls: ['./trip-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripInfoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  trip: TripType | null = null;
  isTransitioning = false;

  readonly TripStatusEnum = TripStatusEnum;

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
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService,
    private alert: AlertService,
    private translate: TranslateService,
    private pageInfo: PageInfoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.pageInfo.setTitle(this.t('TRIPS.EDIT'));

    // Subscribe to trip$ BehaviorSubject (populated by resolver)
    this.tripService.trip$.pipe(takeUntil(this.destroy$)).subscribe((trip) => {
      this.trip = trip;
      this.cdr.markForCheck();
    });
  }

  // ─── COMPUTED ─────────────────────────────────────────
  get sortedStops(): StopType[] {
    if (!this.trip?.stopSchedule?.length) return [];
    return [...this.trip.stopSchedule].sort((a, b) => a.sequence - b.sequence);
  }

  get sortedSegments(): SegmentType[] {
    if (!this.trip?.segments?.length) return [];
    return [...this.trip.segments].sort((a, b) => a.sequence - b.sequence);
  }

  get activeExpressSegments(): ExpressSegmentType[] {
    return this.trip?.expressSegments ?? [];
  }

  get pickupsByPlace(): Record<string, PickupPointType[]> {
    if (!this.trip?.pickupPoints?.length) return {};
    return this.groupBy(this.trip.pickupPoints, 'placeId');
  }

  get dropoffsByPlace(): Record<string, DropoffPointType[]> {
    if (!this.trip?.dropoffPoints?.length) return {};
    return this.groupBy(this.trip.dropoffPoints, 'placeId');
  }

  objectKeys(obj: Record<string, any>): string[] {
    return Object.keys(obj);
  }

  getStopType(stop: StopType, index: number, total: number): string {
    if (index === 0) return this.t('TRIPS.STOPS.TYPES.ORIGIN');
    if (index === total - 1) return this.t('TRIPS.STOPS.TYPES.DESTINATION');
    if (!stop.boardingAllowed && !stop.droppingAllowed)
      return this.t('TRIPS.STOPS.TYPES.TECHNICAL');
    return this.t('TRIPS.STOPS.TYPES.INTERMEDIATE');
  }

  getStopTypeClass(stop: StopType, index: number, total: number): string {
    if (index === 0) return 'badge-light-success';
    if (index === total - 1) return 'badge-light-danger';
    if (!stop.boardingAllowed && !stop.droppingAllowed)
      return 'badge-light-warning';
    return 'badge-light-info';
  }

  // ─── STATUS TRANSITIONS ──────────────────────────────
  get canPublish(): boolean {
    return this.trip?.status === TripStatusEnum.SCHEDULED;
  }

  get canComplete(): boolean {
    return this.trip?.status === TripStatusEnum.ACTIVE;
  }

  get canCancel(): boolean {
    return (
      this.trip?.status === TripStatusEnum.SCHEDULED ||
      this.trip?.status === TripStatusEnum.ACTIVE
    );
  }

  async transitionStatus(nextStatus: TripStatusEnum): Promise<void> {
    if (!this.trip || this.isTransitioning) return;

    let confirmKey: string;
    switch (nextStatus) {
      case TripStatusEnum.ACTIVE:
        confirmKey = 'TRIPS.MESSAGES.PUBLISH_CONFIRM';
        break;
      case TripStatusEnum.COMPLETED:
        confirmKey = 'TRIPS.MESSAGES.STATUS_CONFIRM_TEXT';
        break;
      case TripStatusEnum.CANCELLED:
        confirmKey =
          this.trip.status === TripStatusEnum.ACTIVE
            ? 'TRIPS.MESSAGES.EMERGENCY_CANCEL_CONFIRM'
            : 'TRIPS.MESSAGES.CANCEL_CONFIRM';
        break;
      default:
        confirmKey = 'TRIPS.MESSAGES.STATUS_CONFIRM_TEXT';
    }

    const result = await this.alert.confirm(
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t(confirmKey),
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL'),
    );
    if (!result.isConfirmed) return;

    this.isTransitioning = true;
    this.cdr.markForCheck();

    this.tripService.updateStatus(this.trip.id, nextStatus).subscribe({
      next: () => {
        this.isTransitioning = false;
        this.alert.success(this.t('TRIPS.MESSAGES.STATUS_UPDATED'));
        this.cdr.markForCheck();
      },
      error: () => {
        this.isTransitioning = false;
        this.alert.error(this.t('TRIPS.MESSAGES.STATUS_UPDATE_ERROR'));
        this.cdr.markForCheck();
      },
    });
  }

  // ─── HELPERS ──────────────────────────────────────────
  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private groupBy<T>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce(
      (acc, item) => {
        const k = (item as any)[key] ?? 'unknown';
        (acc[k] = acc[k] || []).push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
