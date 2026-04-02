import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { isEqual } from 'lodash';
import { TranslateModule } from '@ngx-translate/core';

import {
  PermissionDefinitionType,
  PermissionInput,
  PermissionPermissionsType,
  PermissionType,
} from 'src/app/core/models/permission-type';
import { PermissionsService } from './permissions.service';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, NgbModalModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './permissions.component.html',
  styleUrls: ['./permissions.component.scss'],
})
export class PermissionsComponent implements OnInit, OnDestroy {
  private initialValues: any = null;
  private formChangesSub?: Subscription;
  private subscriptions = new Subscription();
  private permissionDefinitions: PermissionDefinitionType[] = [];

  rolesForm: FormGroup;
  isButtonDisabled = true;
  loading$ = this.permissionsService.loading$;
  selectedPermission: PermissionType | null = null;
  permissions$ = this.permissionsService.permissions$;

  constructor(
    private permissionsService: PermissionsService,
    private modalService: NgbModal,
    private fb: FormBuilder,
  ) {
    this.rolesForm = this.buildForm();
  }

  ngOnInit(): void {
    const sub = this.permissionsService.loadInitialData().subscribe({
      next: (data) => {
        this.permissionDefinitions = data.definitions ?? [];
      },
      error: () =>
        this.showAlert(
          'error',
          'Échec du chargement',
          'Impossible de récupérer les permissions. Veuillez réessayer plus tard.',
        ),
    });
    this.subscriptions.add(sub);

    const defsSub = this.permissionsService.definitions$.subscribe((defs) => {
      this.permissionDefinitions = defs ?? [];
    });
    this.subscriptions.add(defsSub);
  }

  get permissionsArray(): FormArray {
    return this.rolesForm.get('permissions') as FormArray;
  }

  openPermissionModal(modal: TemplateRef<any>, permission?: PermissionType) {
    if (!this.permissionDefinitions.length) {
      const sub = this.permissionsService.getPermissionDefinitions().subscribe({
        next: (defs) => {
          this.permissionDefinitions = defs ?? [];
          this.prepareForm(permission);
          this.modalService.open(modal, { centered: true, size: 'lg' });
        },
        error: () =>
          this.showAlert(
            'error',
            'Échec du chargement',
            'Impossible de récupérer les permissions. Veuillez réessayer plus tard.',
          ),
      });
      this.subscriptions.add(sub);
      return;
    }

    this.prepareForm(permission);
    this.modalService.open(modal, { centered: true, size: 'lg' });
  }

  save(modal?: any): void {
    if (this.rolesForm.invalid) {
      this.rolesForm.markAllAsTouched();
      return;
    }

    const payload = this.toPayload(this.rolesForm.value);
    const isEdit = !!this.selectedPermission?.id;

    if (isEdit) {
      const sub = this.permissionsService
        .updatePermission(this.selectedPermission!.id, payload)
        .subscribe({
          next: () => {
            this.showAlert(
              'success',
              'Permission mise à jour',
              'Les permissions ont été mises à jour avec succès.',
            );
            this.resetFormState();
            modal?.close();
          },
          error: () =>
            this.showAlert(
              'error',
              'Échec de la mise à jour',
              'Une erreur est survenue lors de la mise à jour.',
            ),
        });
      this.subscriptions.add(sub);
      return;
    }

    const sub = this.permissionsService.createPermission(payload).subscribe({
      next: () => {
        this.showAlert(
          'success',
          'Permission créée',
          'La permission a été ajoutée avec succès.',
        );
        this.resetFormState();
        modal?.close();
      },
      error: () =>
        this.showAlert(
          'error',
          'Échec de la création',
          'Une erreur est survenue lors de la création.',
        ),
    });
    this.subscriptions.add(sub);
  }

  confirmDelete(permission: PermissionType): void {
    if (!permission?.id) {
      return;
    }

    Swal.fire({
      title: 'Supprimer cette permission ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.permissionsService
          .deletePermission(permission.id)
          .subscribe({
            next: () =>
              this.showAlert(
                'success',
                'Permission supprimée',
                'La permission a été supprimée avec succès.',
              ),
            error: () =>
              this.showAlert(
                'error',
                'Échec de la suppression',
                'Une erreur est survenue lors de la suppression.',
              ),
          });
        this.subscriptions.add(sub);
      }
    });
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
        {
          read: nextValue,
          create: nextValue,
          update: nextValue,
        },
        { emitEvent: false },
      );
    });
    this.rolesForm.markAsDirty();
    this.isButtonDisabled = false;
  }

  permissionsCount(permissions?: PermissionPermissionsType[]): number {
    if (!permissions?.length) {
      return 0;
    }
    return permissions.filter((grant) => this.hasAnyGrant(grant)).length;
  }

  hasAnyGrant(grant?: PermissionPermissionsType): boolean {
    return !!(grant?.read || grant?.create || grant?.update);
  }

  getDefinitionName(permission?: string | PermissionDefinitionType): string {
    if (!permission) {
      return '-';
    }
    if (typeof permission === 'string') {
      return permission;
    }
    return permission.name || permission.code || permission.id || '-';
  }

  isInvalid(controlName: string): boolean {
    const control = this.rolesForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private showAlert(icon: SweetAlertIcon, title: string, text: string): void {
    Swal.fire({
      icon,
      title,
      text,
      timer: icon === 'success' ? 2000 : undefined,
      showConfirmButton: icon !== 'success',
    });
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/\S+/)]],
      permissions: this.fb.array([]),
    });
  }

  private prepareForm(permission?: PermissionType): void {
    this.selectedPermission = permission ?? null;
    this.rolesForm.reset({ name: permission?.name ?? '' });

    const array = this.permissionsArray;
    array.clear();

    const grantMap = new Map<string, PermissionPermissionsType>();
    if (permission?.permissions?.length) {
      permission.permissions.forEach((grant) => {
        const defId =
          typeof grant.permission === 'string'
            ? grant.permission
            : grant.permission?.id;
        if (defId) {
          grantMap.set(defId, grant);
        }
      });
    }

    this.permissionDefinitions.forEach((definition) => {
      const grant = grantMap.get(definition.id ?? '');
      array.push(
        this.fb.group({
          permission: [definition],
          read: [grant?.read ?? false],
          create: [grant?.create ?? false],
          update: [grant?.update ?? false],
        }),
      );
    });

    this.rolesForm.markAsPristine();
    this.rolesForm.markAsUntouched();
    this.initialValues = this.rolesForm.getRawValue();
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.rolesForm.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(values, this.initialValues);
    });
  }

  private resetFormState(): void {
    this.selectedPermission = null;
    this.rolesForm.reset({ name: '' });
    this.permissionsArray.clear();
    this.rolesForm.markAsPristine();
    this.rolesForm.markAsUntouched();
    this.formChangesSub?.unsubscribe();
    this.initialValues = this.rolesForm.getRawValue();
    this.isButtonDisabled = true;
  }

  private toPayload(formValue: any): PermissionInput {
    const companyId =
      localStorage.getItem('companyId') ||
      this.selectedPermission?.target?.company?.id;

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
      name: formValue.name,
      permissions: grants,
      target: companyId ? { company: companyId } : undefined,
    };
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
  }
}
