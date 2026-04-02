import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AccountsService } from 'src/app/core/services/accounts.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { AccountType } from 'src/app/core/models/account.model';
import { CompanyType } from 'src/app/core/models/company.model';

@Component({
  selector: 'app-delete-pos-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './delete-pos-modal.component.html',
  styleUrls: ['./delete-pos-modal.component.scss'],
})
export class DeletePosModalComponent implements OnInit, OnDestroy {
  @Input() accounts: AccountType[] = [];

  accountTargets: AccountType[] = [];
  isLoading = false;
  deletingId: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    public activeModal: NgbActiveModal,
    private accountsService: AccountsService,
    private alert: AlertService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.accountTargets = (this.accounts || []).filter(
      (account) => !!account?.target?.company?.id,
    );
  }

  getCompany(account: AccountType): CompanyType | undefined {
    return account?.target?.company;
  }

  deleteAssignment(account: AccountType): void {
    if (!account?.id || this.deletingId) return;

    this.deletingId = account.id;

    this.accountsService.deleteAccount(account.id).subscribe({
      next: () => {
        this.alert.success(
          this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.SUCCESS'),
        );
        this.accountTargets = this.accountTargets.filter(
          (item) => item.id !== account.id,
        );
        this.deletingId = null;
      },
      error: () => {
        this.alert.error(
          this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
        );
        this.deletingId = null;
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismiss(): void {
    this.activeModal.dismiss();
  }
}
