import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  Validators,
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { values, isEqual } from 'lodash';
import { Subject, takeUntil } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { TranslateModule } from '@ngx-translate/core';

import { RoleEnum } from 'src/app/core/models/user-type';
import { CustomersService } from '../../customers.service';
import { FormHelper } from 'src/app/core/helpers/form-helper';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  initValues: any;
  isSaving = false;
  userForm: FormGroup;
  currentUserId: string;
  isButtonDisabled = true;
  roles = values(RoleEnum);
  user$ = this.customersService.user$;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private customersService: CustomersService,
  ) {}

  ngOnInit(): void {
    this.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      if (!user) return;
      this.currentUserId = user.id;
      this.userForm = this.fb.group({
        firstName: [user.firstName, Validators.required],
        lastName: [user.lastName, Validators.required],
        email: [user.email, [Validators.required, Validators.email]],
        role: [user.role, [Validators.required]],
        phone: this.fb.group({
          countryCode: [user.phone?.countryCode || ''],
          number: [user.phone?.number || ''],
        }),
      });
      this.initValues = this.userForm.value;
      this.userForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.isButtonDisabled = isEqual(this.userForm.value, this.initValues);
        });
    });
  }

  save(): void {
    this.isButtonDisabled = true;
    if (!this.currentUserId) {
      this.showAlert('error', 'Erreur', 'Utilisateur introuvable.');
      return;
    }
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.showAlert(
        'error',
        'Formulaire incomplet',
        'Veuillez vérifier les champs.',
      );
      return;
    }
    this.isSaving = true;
    const input = FormHelper.getChangedValues(
      this.userForm.value,
      this.initValues,
    );
    this.customersService.updateCustomer(this.currentUserId, input).subscribe({
      next: () => {
        this.isSaving = false;
        this.showAlert('success', 'Succès', 'Profil mis à jour.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSaving = false;
        this.showAlert(
          'error',
          'Échec',
          err?.error?.message || 'Une erreur est survenue.',
        );
        this.cdr.markForCheck();
      },
    });
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
