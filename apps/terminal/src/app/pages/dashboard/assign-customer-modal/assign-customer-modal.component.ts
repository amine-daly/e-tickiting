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
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { isEqual } from 'lodash';
import { NgSelectModule } from '@ng-select/ng-select';

import { PermissionsService } from '../../permissions/permissions.service';
import { CompanyService } from '../../companies/company.service';
import { AccountsService } from 'src/app/core/services/accounts.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { AccountType } from 'src/app/core/models/account.model';
import {
  PermissionDefinitionType,
  PermissionPermissionsType,
  PermissionType,
} from 'src/app/core/models/permission-type';
import { CompanyType } from 'src/app/core/models/company.model';

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
  @Input() account?: AccountType;
  @Input() accounts: AccountType[] = [];

  assignForm: FormGroup;
  activeTab = 1;
  isSubmitting = false;
  isButtonDisabled = true;

  // Data - Companies
  companyList: CompanyType[] = [];
  filteredCompanyList: CompanyType[] = [];
  companyLoading = false;
  targetPermissions: PermissionType[] = [];
  permissionsLoading = false;
  roleViewMode: 'choose' | 'add' = 'choose';

  // Data - Permission definitions for creating new permission
  permissionDefinitions: PermissionDefinitionType[] = [];
  definitionsLoading = false;

  private formChangesSub?: Subscription;
  private initialValues: any;
  private destroy$ = new Subject<void>();
  private companySearchInput$ = new Subject<string>();

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private permissionsService: PermissionsService,
    private companyService: CompanyService,
    private accountsService: AccountsService,
    private alert: AlertService,
    private translate: TranslateService,
  ) {
    this.assignForm = this.buildForm();
  }

  ngOnInit(): void {
    this.loadPermissionDefinitions();
    this.setupCompanySearch();
    this.setupCompanySelection();
    this.applyRoleModeValidators();
    this.onCompanySearch('');

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
      company: [null, [Validators.required]],
      selectedPermission: [null],
      permissionName: ['', [Validators.required, Validators.pattern(/\S+/)]],
      permissions: this.fb.array([]),
    });
  }

  private setupCompanySelection(): void {
    this.assignForm
      .get('company')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((company: CompanyType | null) => {
        this.onCompanySelected(company);
      });
  }

  private onCompanySelected(company: CompanyType | null): void {
    this.targetPermissions = [];
    this.assignForm.get('selectedPermission')?.setValue(null);
    this.showChooseRoleView();

    if (!company?.id) {
      return;
    }

    this.permissionsLoading = true;
    this.permissionsService
      .getPermissionsByTarget(company.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permissions) => {
          this.targetPermissions = permissions || [];
          this.permissionsLoading = false;
        },
        error: () => {
          this.targetPermissions = [];
          this.permissionsLoading = false;
        },
      });
  }

  private setupCompanySearch(): void {
    this.companySearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.companyLoading = true;
          this.companyService.pageIndex = 0;
          this.companyService.pageLimit = 100;
          return this.companyService.list(searchString);
        }),
      )
      .subscribe({
        next: (companyList) => {
          this.companyList = companyList || [];
          this.applyCompanyFilter();
          this.companyLoading = false;
        },
        error: () => {
          this.companyLoading = false;
        },
      });
  }

  private applyCompanyFilter(): void {
    // Get already assigned company IDs from accounts
    const assignedCompanyIds = new Set(
      this.accounts
        .map((acc) => acc.target?.company?.id)
        .filter((id): id is string => !!id),
    );
    // Filter out already assigned companies
    this.filteredCompanyList = this.companyList.filter(
      (company) => !assignedCompanyIds.has(company.id || ''),
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

  permissionsCount(permissions?: PermissionPermissionsType[]): number {
    if (!permissions?.length) {
      return 0;
    }
    return permissions.filter((grant) => this.hasAnyGrant(grant)).length;
  }

  onCompanySearch(term: string): void {
    this.companySearchInput$.next(term);
  }

  showAddPermissionView(): void {
    this.roleViewMode = 'add';
    this.applyRoleModeValidators();
  }

  showChooseRoleView(): void {
    this.roleViewMode = 'choose';
    this.applyRoleModeValidators();
  }

  private applyRoleModeValidators(): void {
    const selectedPermissionControl = this.assignForm.get('selectedPermission');
    const permissionNameControl = this.assignForm.get('permissionName');

    if (this.roleViewMode === 'choose') {
      selectedPermissionControl?.setValidators([Validators.required]);
      permissionNameControl?.clearValidators();
    } else {
      selectedPermissionControl?.clearValidators();
      permissionNameControl?.setValidators([
        Validators.required,
        Validators.pattern(/\S+/),
      ]);
    }

    selectedPermissionControl?.updateValueAndValidity({ emitEvent: false });
    permissionNameControl?.updateValueAndValidity({ emitEvent: false });
  }

  isInvalid(controlName: string): boolean {
    const control = this.assignForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  nextTab(): void {
    if (this.activeTab === 1 && this.assignForm.get('company')?.valid) {
      this.activeTab = 2;
    }
  }

  prevTab(): void {
    if (this.activeTab === 2) {
      this.activeTab = 1;
    }
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

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

    if (this.roleViewMode === 'choose') {
      const selectedPermissionId = formValue.selectedPermission?.id;
      if (!selectedPermissionId) {
        this.assignForm.get('selectedPermission')?.markAsTouched();
        this.isSubmitting = false;
        return;
      }
      this.createAccountWithTarget(formValue.company, selectedPermissionId);
      return;
    }

    // Step 1: Create the permission first
    const permissionPayload = this.buildPermissionPayload(formValue);

    this.permissionsService
      .createPermission(permissionPayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (createdPermission) => {
          // Step 2: Create new account with company and permission
          this.createAccountWithTarget(formValue.company, createdPermission.id);
        },
        error: () => {
          this.alert.error(
            this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
          );
          this.isSubmitting = false;
        },
      });
  }

  private buildPermissionPayload(formValue: any): any {
    const companyId =
      formValue.company?.id || localStorage.getItem('companyId');
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
      target: companyId ? { company: companyId } : undefined,
    };
  }

  private createAccountWithTarget(
    company: CompanyType,
    permissionId: string,
  ): void {
    const payload = {
      companyId: company?.id!,
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
        error: () => {
          this.alert.error(
            this.translate.instant('DASHBOARD.ASSIGN.MESSAGES.ERROR'),
          );
          this.isSubmitting = false;
        },
      });
  }

  canSubmit(): boolean {
    if (!this.assignForm.get('company')?.valid || this.isSubmitting) {
      return false;
    }

    if (this.roleViewMode === 'choose') {
      return !!this.assignForm.get('selectedPermission')?.valid;
    }

    return !this.isButtonDisabled && this.assignForm.valid;
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
