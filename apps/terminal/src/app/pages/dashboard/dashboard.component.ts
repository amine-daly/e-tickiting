import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  NgbDropdownModule,
  NgbModal,
  NgbModalModule,
} from '@ng-bootstrap/ng-bootstrap';
import { ModalConfig, ModalComponent } from '../../_metronic/partials';
import { ChartsWidget1Component } from '../../_metronic/partials/content/widgets/charts/charts-widget1/charts-widget1.component';
import { ChartsWidget2Component } from '../../_metronic/partials/content/widgets/charts/charts-widget2/charts-widget2.component';
import { ChartsWidget3Component } from '../../_metronic/partials/content/widgets/charts/charts-widget3/charts-widget3.component';
import { ChartsWidget4Component } from '../../_metronic/partials/content/widgets/charts/charts-widget4/charts-widget4.component';
import { ChartsWidget5Component } from '../../_metronic/partials/content/widgets/charts/charts-widget5/charts-widget5.component';
import { ChartsWidget6Component } from '../../_metronic/partials/content/widgets/charts/charts-widget6/charts-widget6.component';
import { ChartsWidget7Component } from '../../_metronic/partials/content/widgets/charts/charts-widget7/charts-widget7.component';
import { ChartsWidget8Component } from '../../_metronic/partials/content/widgets/charts/charts-widget8/charts-widget8.component';
import { AddPosModalComponent } from './add-pos-modal/add-pos-modal.component';
import { DeletePosModalComponent } from './delete-pos-modal/delete-pos-modal.component';
import { AssignCustomerModalComponent } from './assign-customer-modal/assign-customer-modal.component';
import { AuthService } from 'src/app/modules/auth';
import {
  PointOfSaleType,
  AccountType,
} from 'src/app/core/models/account.model';
import { RoleEnum } from 'src/app/core/models/user-type';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    NgbDropdownModule,
    NgbModalModule,
    ChartsWidget1Component,
    ChartsWidget2Component,
    ChartsWidget3Component,
    ChartsWidget4Component,
    ChartsWidget5Component,
    ChartsWidget6Component,
    ChartsWidget7Component,
    ChartsWidget8Component,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private destroy$ = new Subject<void>();

  modalConfig: ModalConfig = {
    modalTitle: 'Modal title',
    dismissButtonLabel: 'Submit',
    closeButtonLabel: 'Cancel',
  };
  @ViewChild('modal') private modalComponent: ModalComponent;

  currentPos: PointOfSaleType | null = null;
  currentAccount: AccountType | null = null;
  accounts: AccountType[] = [];
  isAdmin = false;

  constructor(
    private modalService: NgbModal,
    private authService: AuthService,
  ) {
    // Subscribe to current POS
    this.authService.pos$.pipe(takeUntil(this.destroy$)).subscribe((pos) => {
      this.currentPos = pos;
    });
    // Subscribe to accounts and get first account + full list
    this.authService.accounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts) => {
        this.accounts = accounts || [];
        this.currentAccount = accounts?.[0] || null;
      });
    // Subscribe to current user and check if admin
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.isAdmin = user?.role === RoleEnum.ADMIN;
      });
  }

  async openModal() {
    return await this.modalComponent.open();
  }

  openAddPosModal(): void {
    this.modalService.open(AddPosModalComponent, {
      centered: true,
      size: 'md',
    });
  }

  openDeletePosModal(): void {
    const modalRef = this.modalService.open(DeletePosModalComponent, {
      centered: true,
      size: 'md',
    });
    modalRef.componentInstance.pos = this.currentPos;
    modalRef.result.then(
      (result) => {
        if (result) {
          // POS deleted successfully - could refresh or update state
        }
      },
      () => {},
    );
  }

  openAssignCustomerModal(): void {
    const modalRef = this.modalService.open(AssignCustomerModalComponent, {
      centered: true,
      size: 'lg',
    });
    modalRef.componentInstance.account = this.currentAccount;
    modalRef.componentInstance.accounts = this.accounts;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
