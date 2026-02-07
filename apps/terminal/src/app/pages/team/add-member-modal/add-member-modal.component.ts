import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { isEqual } from 'lodash';
import { NgSelectModule } from '@ng-select/ng-select';

import { TeamService } from '../team.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { RoleEnum } from 'src/app/core/models/user-type';
import { PermissionType } from 'src/app/core/models/permission-type';
import { FormHelper } from 'src/app/core/helpers/form-helper';

@Component({
  selector: 'app-add-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, NgSelectModule],
  templateUrl: './add-member-modal.component.html',
  styleUrls: ['./add-member-modal.component.scss'],
})
export class AddMemberModalComponent implements OnInit, OnDestroy {
  memberForm: FormGroup;
  permissions: PermissionType[] = [];
  isSubmitting = false;
  isButtonDisabled = true;
  private destroy$ = new Subject<void>();
  private initialValues: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private teamService: TeamService,
    private permissionsService: PermissionsService,
    private alert: AlertService,
    private translate: TranslateService,
  ) {
    this.memberForm = this.buildForm();
  }

  ngOnInit(): void {
    this.loadPermissions();
    // track initial state and enable save only when changes occur
    this.initialValues = this.memberForm.value;
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
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
      },
    });
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
    const posId = localStorage.getItem('posId') || '';

    // Single API call to create user and account
    const payload = {
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
      phone: current.phone,
      password: current.password,
      role: RoleEnum.MANAGER,
      posId,
      permissionId: current.permissionId || undefined,
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
          const backendMsg: string = err?.error?.message || '';
          let message: string;
          if (backendMsg.toLowerCase().includes('already exist')) {
            message = this.translate.instant(
              'TEAM.MESSAGES.EMAIL_ALREADY_EXISTS',
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
