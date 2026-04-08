import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { isEqual } from 'lodash';

import { CompanyService } from '../../companies/company.service';
import { AccountsService } from 'src/app/core/services/accounts.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyType } from 'src/app/core/models/company.model';
import { AccountType } from 'src/app/core/models/account.model';
import { NgSelectComponent } from '@ng-select/ng-select';

@Component({
  selector: 'app-add-pos-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectComponent,
  ],
  templateUrl: './add-pos-modal.component.html',
  styleUrls: ['./add-pos-modal.component.scss'],
})
export class AddPosModalComponent implements OnInit, OnDestroy {
  @Input() account?: AccountType;
  @Input() accounts: AccountType[] = [];

  posForm: FormGroup;
  companyList: CompanyType[] = [];
  filteredCompanyList: CompanyType[] = [];
  loadingCompanies = false;
  isSubmitting = false;
  isButtonDisabled = true;
  private formChangesSub?: Subscription;
  private initialValues: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private companyService: CompanyService,
    private accountsService: AccountsService,
    private alert: AlertService,
    private translate: TranslateService,
  ) {
    this.posForm = this.buildForm();
  }

  ngOnInit(): void {
    this.loadCompanies();
    this.initialValues = this.posForm.value;
    this.formChangesSub = this.posForm.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(values, this.initialValues);
    });
  }

  private loadCompanies(): void {
    this.loadingCompanies = true;
    this.companyService.pageIndex = 0;
    this.companyService.pageLimit = 100;
    this.companyService.list('').subscribe({
      next: (companies) => {
        this.companyList = companies || [];
        const assignedCompanyIds = new Set(
          (this.accounts || [])
            .map((item) => item?.target?.company?.id)
            .filter((id): id is string => !!id),
        );
        this.filteredCompanyList = this.companyList.filter(
          (company) => !assignedCompanyIds.has(company.id || ''),
        );
        this.loadingCompanies = false;
      },
      error: () => {
        this.loadingCompanies = false;
      },
    });
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      company: [null, [Validators.required]],
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.posForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.posForm.invalid) {
      this.posForm.markAllAsTouched();
      return;
    }

    if (!this.account?.id || !this.posForm.value?.company?.id) {
      this.alert.error(
        this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.NO_ACCOUNT'),
      );
      return;
    }

    this.isSubmitting = true;

    this.accountsService
      .addTargetToAccount(this.account.id, {
        companyId: this.posForm.value.company.id,
      })
      .subscribe({
        next: (createdAccount) => {
          this.alert.success(
            this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.SUCCESS'),
          );
          this.activeModal.close(createdAccount);
        },
        error: () => {
          this.alert.error(
            this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
          );
          this.isSubmitting = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
  }

  dismiss(): void {
    this.activeModal.dismiss();
  }
}
