import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { TeamService } from './team.service';
import { TranslateModule } from '@ngx-translate/core';
import { AlertService } from 'src/app/core/services/alert.service';
import { TranslateService } from '@ngx-translate/core';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { AddMemberModalComponent } from './add-member-modal/add-member-modal.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    RouterLink,
    PaginationComponent,
    ToolbarComponent,
    NgbModalModule,
  ],
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss'],
})
export class TeamComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  accounts$ = this.teamService.accounts$;
  loading$ = this.teamService.loading$;
  pagination$ = this.teamService.pagination$;
  page = 1;
  pageSize = this.teamService.pageLimit;
  defaultAvatar = 'assets/media/avatars/300-1.jpg';

  constructor(
    private teamService: TeamService,
    private alert: AlertService,
    private translate: TranslateService,
    private pageInfo: PageInfoService,
    private modalService: NgbModal,
  ) {}

  ngOnInit(): void {
    this.loadPage(1);
    this.pageInfo.setTitle(this.translate.instant('TEAM.TITLE'));
  }

  deleteMember(account: any) {
    if (!account?.id) return;
    this.alert
      .confirm(
        this.translate.instant('COMMON.CONFIRM.DELETE_TITLE'),
        this.translate.instant('COMMON.CONFIRM.DELETE_TEXT'),
        this.translate.instant('COMMON.CONFIRM.DELETE_CONFIRM'),
        this.translate.instant('COMMON.BUTTON.CANCEL'),
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.teamService.deleteAccount(account.id).subscribe({
            next: () => {
              this.alert.success(
                this.translate.instant('TEAM.MESSAGES.DELETE_SUCCESS'),
              );
              this.loadPage(this.page);
            },
            error: () => {
              this.alert.error(
                this.translate.instant('TEAM.MESSAGES.DELETE_ERROR'),
              );
            },
          });
        }
      });
  }

  openAddMemberModal(): void {
    this.modalService.open(AddMemberModalComponent, {
      centered: true,
      size: 'lg',
    });
  }

  onPageChange(page: number): void {
    this.loadPage(page);
  }

  private loadPage(page: number): void {
    this.page = page;
    this.teamService.pageIndex = page - 1;
    this.teamService.getAccountsByTarget().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
