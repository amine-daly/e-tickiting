import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'lodash';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BusinessProfileService } from '../../business-profile/business-profile/business-profile.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { PointOfSaleType } from 'src/app/core/models/account.model';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-delete-pos-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './delete-pos-modal.component.html',
  styleUrls: ['./delete-pos-modal.component.scss'],
})
export class DeletePosModalComponent implements OnInit, OnDestroy {
  posList: PointOfSaleType[] = [];
  isLoading = false;
  deletingId: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    public activeModal: NgbActiveModal,
    private profileService: BusinessProfileService,
    private alert: AlertService,
    private translate: TranslateService,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authService.accounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts) => {
        console.log(
          '🚀 ~ DeletePosModalComponent ~ ngOnInit ~ accounts:',
          accounts,
        );
        this.posList = map(accounts, 'target.pos');
        console.log(
          '🚀 ~ NavbarComponent ~ ngOnInit ~ this.posList:',
          this.posList,
        );
      });
  }

  deletePos(pos: PointOfSaleType): void {
    if (!pos?.id || this.deletingId) return;

    this.deletingId = pos.id;

    this.profileService.deletePos(pos.id).subscribe({
      next: () => {
        this.alert.success(
          this.translate.instant('DASHBOARD.POS.MESSAGES.DELETE_SUCCESS'),
        );
        // Remove from list
        this.posList = this.posList.filter((p) => p.id !== pos.id);
        this.deletingId = null;
      },
      error: (err) => {
        this.alert.error(
          err?.error?.message ||
            this.translate.instant('DASHBOARD.POS.MESSAGES.DELETE_ERROR'),
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
