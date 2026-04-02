import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, from, takeUntil } from 'rxjs';
import { isEqual } from 'lodash';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PointOfSaleType } from 'src/app/core/models/account.model';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { PosAdminService } from '../pos-admin.service';
import { finalize } from 'rxjs/operators';
import { AmazonS3Helper } from '../../../../../../../../libs/helpers/amazon-s3-helper';

@Component({
  standalone: true,
  selector: 'app-pos-details',
  templateUrl: './pos-details.component.html',
  providers: [AmazonS3Helper],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ToolbarComponent,
  ],
})
export class PosDetailsComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private destroy$ = new Subject<void>();

  posForm: FormGroup;
  pos: PointOfSaleType;
  companyId: string;
  isSubmitting = false;
  isUploadingPicture = false;
  isButtonDisabled = true;

  constructor(
    private fb: FormBuilder,
    private posService: PosAdminService,
    private route: ActivatedRoute,
    private router: Router,
    private pageInfo: PageInfoService,
    private alert: AlertService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private amazonS3Helper: AmazonS3Helper,
  ) {}

  ngOnInit(): void {
    this.companyId =
      this.route.parent?.snapshot.paramMap.get('companyId') || '';

    this.posService.pos$.pipe(takeUntil(this.destroy$)).subscribe((pos) => {
      this.pos = pos;
      this.posForm = this.fb.group({
        title: [this.pos?.title || '', [Validators.required]],
        subtitle: [this.pos?.subtitle || ''],
        email: [this.pos?.email || '', [Validators.email]],
        picture: this.fb.group({
          baseUrl: [this.pos?.picture?.baseUrl || ''],
          path: [this.pos?.picture?.path || ''],
        }),
        phone: this.fb.group({
          countryCode: [this.pos?.phone?.countryCode || ''],
          number: [this.pos?.phone?.number || ''],
        }),
        location: this.fb.group({
          addressLine: [this.pos?.location?.addressLine || ''],
          city: [this.pos?.location?.city || ''],
          zipCode: [this.pos?.location?.zipCode || ''],
        }),
      });

      this.initialValues = this.posForm.getRawValue();
      this.posForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((val) => {
          this.isButtonDisabled = isEqual(val, this.initialValues);
        });
      this.cdr.markForCheck();
    });
    this.pageInfo.setTitle(
      this.pos ? 'POS.FORM.EDIT_TITLE' : 'POS.FORM.CREATE_TITLE',
    );
  }

  isInvalid(controlName: string): boolean {
    const control = this.posForm.get(controlName);
    return control?.invalid && (control?.dirty || control?.touched);
  }

  getPictureUrl(): string | null {
    const picture = this.posForm?.get('picture')?.value;
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
      const previousPath = this.posForm.get('picture.path')?.value;
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
            this.posForm.get('picture')?.patchValue({
              baseUrl: uploadRes?.baseUrl || '',
              path: nextPath,
            });
            console.log(
              '🚀 ~ CompanyDetailsComponent ~ uploadPicture ~ this.posForm:',
              this.posForm.value,
            );

            if (previousPath && previousPath !== nextPath) {
              this.amazonS3Helper.deleteFileFromAws(previousPath);
            }

            if (this.pos) {
              this.persistMediaChanges();
            } else {
              this.posForm.markAsDirty();
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
      picture: this.posForm.get('picture')?.value,
    };
    this.posService
      .update(this.pos.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(this.translate.instant('POS.FORM.UPDATED'));
        },
        error: () => {
          this.alert.error(
            this.translate.instant('COMMON.MESSAGES.GENERIC_ERROR'),
          );
        },
      });
  }

  removePicture(): void {
    const oldPath = this.posForm.get('picture.path')?.value;
    if (oldPath) {
      this.amazonS3Helper.deleteFileFromAws(oldPath);
    }
    this.posForm.get('picture')?.patchValue({ baseUrl: '', path: '' });
    if (this.pos) {
      this.persistMediaChanges();
    } else {
      this.posForm.markAsDirty();
    }
    this.isButtonDisabled = false;
  }

  submit(): void {
    this.isButtonDisabled = true;
    if (this.posForm.invalid) {
      this.posForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const changes = FormHelper.getChangedValues(
      this.initialValues,
      this.posForm.getRawValue(),
    );

    if (this.pos) {
      this.posService.update(this.pos.id, changes).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.alert.success(this.translate.instant('POS.FORM.UPDATED'));
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSubmitting = false;
          this.alert.error(
            this.translate.instant('COMMON.MESSAGES.GENERIC_ERROR'),
          );
          this.cdr.markForCheck();
        },
      });
    } else {
      this.posService
        .create({ ...changes, companyId: this.companyId })
        .subscribe({
          next: (created) => {
            this.isSubmitting = false;
            this.alert.success(this.translate.instant('POS.FORM.CREATED'));
            this.router.navigate([
              '/companies',
              this.companyId,
              'pos',
              created.id,
              'edit',
            ]);
            this.cdr.markForCheck();
          },
          error: () => {
            this.isSubmitting = false;
            this.alert.error(
              this.translate.instant('COMMON.MESSAGES.GENERIC_ERROR'),
            );
            this.cdr.markForCheck();
          },
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
