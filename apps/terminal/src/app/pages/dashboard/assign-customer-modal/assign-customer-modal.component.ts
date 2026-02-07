import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbActiveModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map as rxMap,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { isEqual, map } from 'lodash';
import { NgSelectModule } from '@ng-select/ng-select';

import { PermissionsService } from '../../permissions/permissions.service';
import { BusinessProfileService } from '../../business-profile/business-profile/business-profile.service';
import { AccountsService } from 'src/app/core/services/accounts.service';
import { AlertService } from 'src/app/core/services/alert.service';
import {
  PointOfSaleType,
  AccountType,
} from 'src/app/core/models/account.model';
import {
  PermissionDefinitionType,
  PermissionPermissionsType,
} from 'src/app/core/models/permission-type';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-assign-customer-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectModule,
    NgbNavModule,
  ],
  templateUrl: './assign-customer-modal.component.html',
  styleUrls: ['./assign-customer-modal.component.scss'],
})
export class AssignCustomerModalComponent implements OnInit, OnDestroy {
  private unsubscribeAll = new Subject<void>();

  @Input() account?: AccountType;
  @Input() accounts: AccountType[] = [];

  assignForm: FormGroup;
  activeTab = 1;
  isSubmitting = false;
  isButtonDisabled = true;

  // Data - POS
  posList: PointOfSaleType[] = [];
  filteredPosList: PointOfSaleType[] = [];
  posLoading = false;

  // Data - Permission definitions for creating new permission
  permissionDefinitions: PermissionDefinitionType[] = [];
  definitionsLoading = false;

  private formChangesSub?: Subscription;
  private initialValues: any;
  private destroy$ = new Subject<void>();
  private posSearchInput$ = new Subject<string>();

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private permissionsService: PermissionsService,
    private businessProfileService: BusinessProfileService,
    private accountsService: AccountsService,
    private alert: AlertService,
    private translate: TranslateService,
    private authService: AuthService,
  ) {
    this.assignForm = this.buildForm();
  }

  ngOnInit(): void {
    this.loadPermissionDefinitions();
    this.setupPosSearch();
    this.authService.accounts$
      .pipe(
        takeUntil(this.unsubscribeAll),
        rxMap((accounts) => {
          this.posList = map(accounts, (account) => account?.target?.pos);
        }),
      )
      .subscribe();

    this.initialValues = this.assignForm.getRawValue();
    this.formChangesSub = this.assignForm.valueChanges.subscribe(() => {
      this.isButtonDisabled = isEqual(
        this.assignForm.getRawValue(),
        this.initialValues,
      );
    });
  }

  get permissionsArray(): FormArray {
    return this.assignForm.get('permissions') as FormArray;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      pos: [null, [Validators.required]],
      permissionName: ['', [Validators.required, Validators.pattern(/\S+/)]],
      permissions: this.fb.array([]),
    });
  }

  private setupPosSearch(): void {
    this.posSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.posLoading = true;
          return this.businessProfileService.searchPos(searchString, 50);
        }),
      )
      .subscribe({
        next: (posList) => {
          this.posList = posList;
          this.applyPosFilter();
          this.posLoading = false;
        },
        error: () => {
          this.posLoading = false;
        },
      });
  }

  private applyPosFilter(): void {
    // Get already assigned POS IDs from accounts
    const assignedPosIds = new Set(
      this.accounts
        .map((acc) => acc.target?.pos?.id)
        .filter((id): id is string => !!id),
    );
    // Filter out already assigned POS
    this.filteredPosList = this.posList.filter(
      (pos) => !assignedPosIds.has(pos.id || ''),
    );
  }

  private loadPermissionDefinitions(): void {
    this.definitionsLoading = true;
    this.permissionsService
      .getPermissionDefinitions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (definitions) => {
          this.permissionDefinitions = definitions || [];
          this.initPermissionsArray();
          this.definitionsLoading = false;
        },
        error: () => {
          this.definitionsLoading = false;
        },
      });
  }

  private initPermissionsArray(): void {
    const array = this.permissionsArray;
    array.clear();
    this.permissionDefinitions.forEach((definition) => {
      array.push(
        this.fb.group({
          permission: [definition],
          read: [false],
          create: [false],
          update: [false],
        }),
      );
    });
    // Update initial values after array is populated
    this.initialValues = this.assignForm.getRawValue();
  }

  toggleCheckAll(): void {
    const controls = this.permissionsArray.controls;
    const allChecked = controls.every((control) => {
      const value = control.value as PermissionPermissionsType;
      return !!value.read && !!value.create && !!value.update;
    });
    const nextValue = !allChecked;
    controls.forEach((control) => {
      control.patchValue(
        { read: nextValue, create: nextValue, update: nextValue },
        { emitEvent: false },
      );
    });
    this.assignForm.markAsDirty();
    this.isButtonDisabled = false;
  }

  hasAnyGrant(grant?: PermissionPermissionsType): boolean {
    return !!(grant?.read || grant?.create || grant?.update);
  }

  onPosSearch(term: string): void {
    this.posSearchInput$.next(term);
  }

  isInvalid(controlName: string): boolean {
    const control = this.assignForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  nextTab(): void {
    if (this.activeTab === 1 && this.assignForm.get('pos')?.valid) {
      this.activeTab = 2;
    }
  }

  prevTab(): void {
    if (this.activeTab === 2) {
      this.activeTab = 1;
    }
  }

  submit(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }

    if (!this.account?.id) {
      this.alert.error(
        this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.NO_ACCOUNT'),
      );
      return;
    }

    this.isSubmitting = true;
    const formValue = this.assignForm.getRawValue();

    // Step 1: Create the permission first
    const permissionPayload = this.buildPermissionPayload(formValue);

    this.permissionsService
      .createPermission(permissionPayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (createdPermission) => {
          // Step 2: Create new account with POS and permission
          this.createAccountWithTarget(formValue.pos, createdPermission.id);
        },
        error: (err) => {
          this.alert.error(
            err?.error?.message ||
              this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
          );
          this.isSubmitting = false;
        },
      });
  }

  private buildPermissionPayload(formValue: any): any {
    const posId = formValue.pos?.id || localStorage.getItem('posId');
    const grants = (formValue.permissions ?? [])
      .map((item: any) => {
        const permissionId = item?.permission?.id;
        if (!permissionId) {
          return null;
        }
        return {
          permission: permissionId,
          read: !!item.read,
          create: !!item.create,
          update: !!item.update,
        };
      })
      .filter((item: any) => item && (item.read || item.create || item.update));

    return {
      name: formValue.permissionName,
      permissions: grants,
      target: posId ? { pos: posId } : undefined,
    };
  }

  private createAccountWithTarget(
    pos: PointOfSaleType,
    permissionId: string,
  ): void {
    const payload = {
      posId: pos?.id!,
      permissionId: permissionId,
    };

    this.accountsService
      .addTargetToAccount(this.account!.id!, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newAccount) => {
          this.alert.success(
            this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.SUCCESS'),
          );
          this.activeModal.close(newAccount);
        },
        error: (err) => {
          this.alert.error(
            err?.error?.message ||
              this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
          );
          this.isSubmitting = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismiss(): void {
    this.activeModal.dismiss();
  }
}
