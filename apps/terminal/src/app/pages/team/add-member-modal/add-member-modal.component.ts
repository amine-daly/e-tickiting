import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { isEqual, values } from 'lodash';
import { from, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { NgSelectComponent } from '@ng-select/ng-select';

import { AmazonS3Helper } from '../../../../../../../libs/helpers/amazon-s3-helper';
import { TeamService } from '../team.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { RoleEnum } from 'src/app/core/models/user-type';
import { PermissionType } from 'src/app/core/models/permission-type';
import { RegisterAccountForTargetPayload } from 'src/app/core/models/account.model';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { resolveUserErrorMessage } from 'src/app/core/helpers/user-error-message.helper';

@Component({
  selector: 'app-add-member-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectComponent,
  ],
  templateUrl: './add-member-modal.component.html',
  styleUrls: ['./add-member-modal.component.scss'],
  providers: [AmazonS3Helper],
})
export class AddMemberModalComponent implements OnInit, OnDestroy {
  memberForm: FormGroup;
  permissions: PermissionType[] = [];
  roles = values(RoleEnum);
  defaultAvatar = 'assets/media/avatars/blank.png';
  isSubmitting = false;
  isButtonDisabled = true;
  isUploadingPicture = false;
  private destroy$ = new Subject<void>();
  private initialValues: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private teamService: TeamService,
    private permissionsService: PermissionsService,
    private alert: AlertService,
    private translate: TranslateService,
    private amazonS3Helper: AmazonS3Helper,
  ) {
    this.memberForm = this.buildForm();
  }

  ngOnInit(): void {
    this.loadPermissions();
    // track initial state and enable save only when changes occur
    this.initialValues = this.memberForm.getRawValue();
    this.memberForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((values) => {
        this.isButtonDisabled = isEqual(values, this.initialValues);
      });
  }

  private buildForm(): FormGroup {
    return this.fb.group(
      {
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        phone: this.fb.group({
          countryCode: ['', [Validators.required]],
          number: ['', [Validators.required]],
        }),
        picture: this.fb.group({
          baseUrl: [''],
          path: [''],
        }),
        role: [Validators.required],
        permissionId: [undefined, Validators.required],
        password: ['', [Validators.required]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  private passwordMatchValidator(
    group: FormGroup,
  ): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  private loadPermissions(): void {
    this.permissionsService
      .getPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permissions) => {
          this.permissions = permissions;
        },
      });
  }

  getPictureUrl(): string | null {
    const picture = this.memberForm?.get('picture')?.value;
    const baseUrl = (picture?.baseUrl || '').replace(/\/+$/, '');
    const path = (picture?.path || '').replace(/^\/+/, '');

    if (!baseUrl || !path) {
      return null;
    }

    return `${baseUrl}/${path}`;
  }

  uploadPicture(): void {
    if (this.isUploadingPicture) {
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }

      this.isUploadingPicture = true;

      const previousPath = this.memberForm.get('picture.path')?.value;
      const storageKey =
        localStorage.getItem('companyId') || localStorage.getItem('posId');
      const { objectKey, request$ } = this.amazonS3Helper.uploadS3Aws(
        file,
        storageKey,
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
            this.memberForm.get('picture')?.patchValue({
              baseUrl: uploadRes?.baseUrl || '',
              path: nextPath,
            });

            if (previousPath && previousPath !== nextPath) {
              this.amazonS3Helper.deleteFileFromAws(previousPath);
            }

            this.memberForm.markAsDirty();
          },
          error: (err) => {
            const safeMessage = resolveUserErrorMessage(
              err,
              [
                {
                  pattern:
                    /maximum upload size exceeded|payload too large|file.*too.*large/i,
                  message: 'Le fichier est trop volumineux.',
                },
                {
                  pattern: /access denied|forbidden|unauthorized/i,
                  message: 'Action non autorisee.',
                },
              ],
              'Une erreur est survenue.',
            );
            this.alert.error('Échec', safeMessage);
          },
        });
    };

    fileInput.click();
  }

  removePicture(): void {
    const oldPath = this.memberForm.get('picture.path')?.value;
    if (oldPath) {
      this.amazonS3Helper.deleteFileFromAws(oldPath);
    }

    this.memberForm.get('picture')?.patchValue({ baseUrl: '', path: '' });
    this.memberForm.markAsDirty();
  }

  isInvalid(controlName: string): boolean {
    const control = this.memberForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  hasError(errorName: string): boolean {
    return (
      this.memberForm.hasError(errorName) &&
      (this.memberForm.get('confirmPassword')?.dirty ||
        this.memberForm.get('confirmPassword')?.touched)
    );
  }

  submit(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const current = this.memberForm.value;
    const changes = FormHelper.getChangedValues(
      current,
      this.initialValues || {},
    );

    if (Object.keys(changes).length === 0) {
      this.memberForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const companyId = localStorage.getItem('companyId') || '';
    const picture = this.memberForm.get('picture')?.value;

    // Single API call to create user and account
    const payload: RegisterAccountForTargetPayload = {
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
      phone: current.phone,
      password: current.password,
      role: current.role || RoleEnum.MANAGER,
      companyId,
      permissionId: current.permissionId || undefined,
      ...(picture?.baseUrl && picture?.path ? { picture } : {}),
    };

    this.teamService
      .registerAccountForTarget(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant('TEAM.MESSAGES.CREATE_SUCCESS'),
          );
          this.activeModal.close(true);
        },
        error: (err) => {
          const backendMsg: string = `${err?.error?.message || ''}`.trim();
          const normalizedMsg = backendMsg.toLowerCase();
          let message: string;

          if (
            normalizedMsg.includes('already has an account with this company')
          ) {
            message = this.translate.instant('TEAM.MESSAGES.ALREADY_ASSIGNED');
          } else if (
            normalizedMsg.includes('email and phone belong to different users')
          ) {
            message = this.translate.instant('TEAM.MESSAGES.CONTACT_CONFLICT');
          } else if (
            normalizedMsg.includes('email already exists') ||
            normalizedMsg.includes('user with this email already exists') ||
            normalizedMsg.includes('already exist')
          ) {
            message = this.translate.instant(
              'TEAM.MESSAGES.EMAIL_ALREADY_EXISTS',
            );
          } else if (normalizedMsg.includes('phone number already exists')) {
            message = this.translate.instant(
              'TEAM.MESSAGES.PHONE_ALREADY_EXISTS',
            );
          } else {
            message = this.translate.instant('TEAM.MESSAGES.CREATE_ERROR');
          }
          this.alert.error(message);
          this.isSubmitting = false;
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
