import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PointOfSaleType } from 'src/app/core/models/account.model';
import { IPagination } from 'src/app/core/models/paginate-model';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { PosAdminService } from '../pos-admin.service';

@Component({
  standalone: true,
  selector: 'app-pos-list',
  templateUrl: './pos-list.component.html',
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    PaginationComponent,
    ToolbarComponent,
  ],
})
export class PosListComponent implements OnInit, OnDestroy {
  posList: PointOfSaleType[] = [];
  pagination: IPagination;
  loading = false;
  companyId: string;
  page = 1;
  pageSize = this.posService.pageLimit;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private pageInfo: PageInfoService,
    private alertService: AlertService,
    private posService: PosAdminService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.companyId =
      this.route.parent?.snapshot.paramMap.get('companyId') || '';
    this.pageInfo.setTitle(this.translate.instant('POS.LIST.TITLE'));

    this.posService.posList$
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        this.posList = list;
        this.cdr.markForCheck();
      });

    this.posService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe((p) => {
        this.pagination = p;
        this.cdr.markForCheck();
      });

    this.posService.loading$.pipe(takeUntil(this.destroy$)).subscribe((l) => {
      this.loading = l;
      this.cdr.markForCheck();
    });

    this.loadPage(1);
  }

  loadList(searchString = ''): void {
    this.posService
      .list(this.companyId, searchString)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.page = 1;
    this.posService.pageIndex = this.page - 1;
    this.loadList(value);
  }

  onPageChange(page: number): void {
    this.page = page;
    this.posService.pageIndex = Math.max(0, page - 1);
    this.loadList();
  }

  private loadPage(page: number): void {
    this.page = page;
    this.posService.pageIndex = page - 1;
    this.loadList();
  }

  getPictureUrl(pos: PointOfSaleType): string {
    if (pos.picture?.baseUrl && pos.picture?.path) {
      return pos.picture.baseUrl + '/' + pos.picture.path;
    }
    return './assets/media/svg/files/blank-image.svg';
  }

  deletePos(pos: PointOfSaleType): void {
    this.alertService
      .confirm(
        this.translate.instant('COMMON.CONFIRM.DELETE_TITLE'),
        this.translate.instant('POS.MESSAGES.CONFIRM_DELETE'),
        this.translate.instant('COMMON.CONFIRM.DELETE_CONFIRM'),
        this.translate.instant('COMMON.BUTTON.CANCEL'),
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.posService.delete(pos.id).subscribe({
            next: () =>
              this.alertService.success(
                this.translate.instant('POS.MESSAGES.DELETE_SUCCESS'),
              ),
            error: () =>
              this.alertService.error(
                this.translate.instant('POS.MESSAGES.DELETE_ERROR'),
              ),
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
