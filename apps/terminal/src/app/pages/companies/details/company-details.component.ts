import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { keys } from 'lodash';
import { Subject, from } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { CompanyService } from '../company.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { CompanyType } from 'src/app/core/models/company.model';
import { CurrencyType } from 'src/app/core/models/account.model';
import { AmazonS3Helper } from '../../../../../../../libs/helpers/amazon-s3-helper';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    ToolbarComponent,
  ],
  selector: 'app-company-details',
  templateUrl: './company-details.component.html',
  providers: [AmazonS3Helper],
})
export class CompanyDetailsComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private destroy$ = new Subject<void>();

  companyForm: FormGroup;
  company: CompanyType;
  currencies: CurrencyType[] = [];
  isSubmitting = false;
  isUploadingPicture = false;
  isButtonDisabled = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private pageInfo: PageInfoService,
    private translate: TranslateService,
    private companyService: CompanyService,
    private amazonS3Helper: AmazonS3Helper,
  ) {}

  ngOnInit(): void {
    this.loadCurrencies();
    this.companyService.company$
      .pipe(takeUntil(this.destroy$))
      .subscribe((company) => {
        this.company = company;
        this.buildForm();
        this.pageInfo.setTitle(
          this.translate.instant(
            this.company
              ? 'COMPANIES.FORM.EDIT_TITLE'
              : 'COMPANIES.FORM.CREATE_TITLE',
          ),
        );
      });
  }

  private loadCurrencies(): void {
    this.companyService
      .getCurrencies()
      .pipe(takeUntil(this.destroy$))
      .subscribe((currencies) => {
        this.currencies = currencies;
        this.cdr.markForCheck();
      });
  }

  private buildForm(): void {
    this.companyForm = this.fb.group({
      name: [this.company?.name || '', [Validators.required]],
      legalName: [this.company?.legalName || ''],
      taxId: [this.company?.taxId || ''],
      platformFeePercentage: [
        this.company?.platformFeePercentage ?? 5,
        [Validators.min(0), Validators.max(100)],
      ],
      currencyId: [this.company?.currencyId || ''],
      emailTemplate: [this.company?.emailTemplate || ''],
      picture: this.fb.group({
        baseUrl: [this.company?.picture?.baseUrl || ''],
        path: [this.company?.picture?.path || ''],
      }),
      bankAccount: this.fb.group({
        iban: [this.company?.bankAccount?.iban || ''],
        bankName: [this.company?.bankAccount?.bankName || ''],
        accountHolder: [this.company?.bankAccount?.accountHolder || ''],
      }),
      contact: this.fb.group({
        email: [this.company?.contact?.email || '', Validators.email],
        phone: this.fb.group({
          countryCode: [this.company?.contact?.phone?.countryCode || '+216'],
          number: [this.company?.contact?.phone?.number || ''],
        }),
      }),
    });
    this.initialValues = this.companyForm.getRawValue();
    this.onFormChanges();
  }

  onFormChanges(): void {
    this.companyForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const changed = FormHelper.getChangedValues(
          this.initialValues,
          this.companyForm.getRawValue(),
        );
        this.isButtonDisabled = keys(changed).length === 0;
      });
  }

  getPictureUrl(): string | null {
    const picture = this.companyForm?.get('picture')?.value;
    const baseUrl = (picture?.baseUrl || '').replace(/\/+$/, '');
    const path = (picture?.path || '').replace(/^\/+/, '');
    if (!baseUrl || !path) {
      return null;
    }
    return `${baseUrl}/${path}`;
  }

  uploadPicture(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }

      this.isUploadingPicture = true;
      this.cdr.markForCheck();
      const posId = localStorage.getItem('posId');
      const previousPath = this.companyForm.get('picture.path')?.value;
      const { objectKey, request$ } = this.amazonS3Helper.uploadS3Aws(
        file,
        posId,
      );

      from(request$)
        .pipe(
          finalize(() => {
            this.isUploadingPicture = false;
          }),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: (uploadRes: any) => {
            const nextPath = uploadRes?.path || objectKey;
            this.companyForm.get('picture')?.patchValue({
              baseUrl: uploadRes?.baseUrl || '',
              path: nextPath,
            });
            console.log(
              '🚀 ~ CompanyDetailsComponent ~ uploadPicture ~ this.companyForm:',
              this.companyForm.value,
            );

            if (previousPath && previousPath !== nextPath) {
              this.amazonS3Helper.deleteFileFromAws(previousPath);
            }

            if (this.company) {
              this.persistMediaChanges();
            } else {
              this.companyForm.markAsDirty();
            }

            this.cdr.markForCheck();
          },
          error: () => {
            this.alert.error(
              this.translate.instant('COMMON.MESSAGES.GENERIC_ERROR'),
            );
          },
        });
    };

    fileInput.click();
  }

  private persistMediaChanges(): void {
    const payload = {
      picture: this.companyForm.get('picture')?.value,
    };
    this.companyService
      .update(this.company.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant('COMPANIES.MESSAGES.UPDATE_SUCCESS'),
          );
        },
        error: () => {
          this.alert.error(
            this.translate.instant('COMPANIES.MESSAGES.SAVE_ERROR'),
          );
        },
      });
  }

  removePicture(): void {
    const oldPath = this.companyForm.get('picture.path')?.value;
    if (oldPath) {
      this.amazonS3Helper.deleteFileFromAws(oldPath);
    }
    this.companyForm.get('picture')?.patchValue({ baseUrl: '', path: '' });
    if (this.company) {
      this.persistMediaChanges();
    } else {
      this.companyForm.markAsDirty();
    }
    this.isButtonDisabled = false;
  }

  submit(): void {
    if (this.companyForm.invalid) {
      this.alert.error(this.translate.instant('COMMON.FORM_INVALID'));
      return;
    }

    this.isSubmitting = true;
    const changed = FormHelper.getChangedValues(
      this.initialValues,
      this.companyForm.getRawValue(),
    );

    const submitAction = this.company
      ? this.companyService.update(this.company.id, changed)
      : this.companyService.create(this.companyForm.getRawValue());

    submitAction
      .pipe(
        finalize(() => (this.isSubmitting = false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant(
              this.company
                ? 'COMPANIES.MESSAGES.UPDATE_SUCCESS'
                : 'COMPANIES.MESSAGES.CREATE_SUCCESS',
            ),
          );
          this.router.navigateByUrl('/companies');
        },
        error: (err) => {
          this.alert.error(
            this.translate.instant('COMPANIES.MESSAGES.SAVE_ERROR'),
          );
        },
      });
  }

  isInvalid(field: string): boolean {
    const control = this.companyForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
