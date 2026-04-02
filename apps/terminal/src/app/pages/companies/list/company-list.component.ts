import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyService } from '../company.service';
import { CompanyType } from 'src/app/core/models/company.model';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    PaginationComponent,
    ToolbarComponent,
  ],
  selector: 'app-company-list',
  templateUrl: './company-list.component.html',
})
export class CompanyListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  companies$ = this.companyService.companies$;
  loading$ = this.companyService.loading$;
  pagination$ = this.companyService.pagination$;
  page = 1;
  pageSize = this.companyService.pageLimit;

  constructor(
    private alert: AlertService,
    private pageInfo: PageInfoService,
    private translate: TranslateService,
    private companyService: CompanyService,
  ) {}

  ngOnInit(): void {
    this.loadPage(1);
    this.pageInfo.setTitle(this.translate.instant('COMPANIES.TITLE'));
  }

  getLogoUrl(company: CompanyType): string | null {
    const pic = company?.picture;
    if (!pic?.baseUrl || !pic?.path) return null;
    return `${pic.baseUrl}/${pic.path}`;
  }

  toggleStatus(company: CompanyType): void {
    const newStatus = company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.companyService.updateStatus(company.id, newStatus).subscribe({
      next: () => {
        this.alert.success(
          this.translate.instant('COMPANIES.MESSAGES.STATUS_UPDATED'),
        );
      },
      error: () => {
        this.alert.error(
          this.translate.instant('COMPANIES.MESSAGES.STATUS_ERROR'),
        );
      },
    });
  }

  deleteCompany(company: CompanyType): void {
    if (!company?.id) return;
    this.alert
      .confirm(
        this.translate.instant('COMMON.CONFIRM.DELETE_TITLE'),
        this.translate.instant('COMMON.CONFIRM.DELETE_TEXT'),
        this.translate.instant('COMMON.CONFIRM.DELETE_CONFIRM'),
        this.translate.instant('COMMON.BUTTON.CANCEL'),
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.companyService.delete(company.id).subscribe({
            next: () => {
              this.alert.success(
                this.translate.instant('COMPANIES.MESSAGES.DELETE_SUCCESS'),
              );
              this.loadPage(this.page);
            },
            error: (err) => {
              const msg = err?.error?.message || '';
              if (msg.includes('has active POS')) {
                this.alert.error(
                  this.translate.instant('COMPANIES.MESSAGES.HAS_ACTIVE_POS'),
                );
              } else {
                this.alert.error(
                  this.translate.instant('COMPANIES.MESSAGES.DELETE_ERROR'),
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
    this.companyService.pageIndex = page - 1;
    this.companyService.list().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
