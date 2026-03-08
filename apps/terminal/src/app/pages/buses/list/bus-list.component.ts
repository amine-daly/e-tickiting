import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { BusService } from '../bus.service';
import { AmenityEnum, BusType } from 'src/app/core/models/bus.model';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    PaginationComponent,
    ToolbarComponent,
  ],
  selector: 'app-bus-list',
  templateUrl: './bus-list.component.html',
})
export class BusListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  buses$ = this.busService.buses$;
  loading$ = this.busService.loading$;
  pagination$ = this.busService.pagination$;
  page = 1;
  pageSize = this.busService.pageLimit;

  /** Maps AmenityEnum → duotone icon class */
  readonly amenityIcons: Record<string, string> = {
    [AmenityEnum.WIFI]: 'ki-duotone ki-wifi',
    [AmenityEnum.POWER_OUTLET]: 'ki-duotone ki-electricity',
    [AmenityEnum.TV]: 'ki-duotone ki-screen',
    [AmenityEnum.SNACKS]: 'ki-duotone ki-coffee',
    [AmenityEnum.AC]: 'ki-duotone ki-cloud',
    [AmenityEnum.TOILET]: 'ki-duotone ki-drop',
    [AmenityEnum.LUGGAGE]: 'ki-duotone ki-briefcase',
    [AmenityEnum.USB]: 'ki-duotone ki-usb',
  };

  constructor(
    private busService: BusService,
    private alert: AlertService,
    private translate: TranslateService,
    private pageInfo: PageInfoService,
  ) {}

  ngOnInit(): void {
    this.loadPage(1);
    this.pageInfo.setTitle(this.translate.instant('BUSES.TITLE'));
  }

  getPictureUrl(bus: BusType): string | null {
    const pic = bus?.media?.pictures?.[0];
    if (!pic?.baseUrl || !pic?.path) return null;
    return `${pic.baseUrl}/${pic.path}`;
  }

  deleteBus(bus: BusType): void {
    if (!bus?.id) return;
    this.alert
      .confirm(
        this.translate.instant('COMMON.CONFIRM.DELETE_TITLE'),
        this.translate.instant('COMMON.CONFIRM.DELETE_TEXT'),
        this.translate.instant('COMMON.CONFIRM.DELETE_CONFIRM'),
        this.translate.instant('COMMON.BUTTON.CANCEL'),
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.busService.delete(bus.id).subscribe({
            next: () => {
              this.alert.success(
                this.translate.instant('BUSES.MESSAGES.DELETE_SUCCESS'),
              );
              this.loadPage(this.page);
            },
            error: (err) => {
              const msg = err?.error?.message || '';
              if (msg.includes('BUS_IN_ACTIVE_TRIP')) {
                this.alert.error(
                  this.translate.instant('BUSES.MESSAGES.BUS_IN_ACTIVE_TRIP'),
                );
              } else {
                this.alert.error(
                  this.translate.instant('BUSES.MESSAGES.DELETE_ERROR'),
                );
              }
            },
          });
        }
      });
  }

  onPageChange(page: number): void {
    this.loadPage(page);
  }

  private loadPage(page: number): void {
    this.page = page;
    this.busService.pageIndex = page - 1;
    this.busService.list().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
