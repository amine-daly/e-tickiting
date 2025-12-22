import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { isEqual } from 'lodash';

import { FormHelper } from 'src/app/core/helpers/form-helper';
import { PhoneType, UserType } from 'src/app/core/models/user-type';
import {
  CustomerCreatePayload,
  CustomerUpdatePayload,
  CustomersService,
} from './customers.service';
import { TranslateModule } from '@ngx-translate/core';

type NormalizedCustomerValue = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: PhoneType;
};

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, NgbModalModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
})
export class CustomersComponent implements OnInit, OnDestroy {
  users$ = this.customersService.users$;
  loading$ = this.customersService.loading$;

  form: FormGroup;
  isButtonDisabled = true;
  editing = false;

  private subscriptions = new Subscription();
  private formChangesSub?: Subscription;
  private selectedCustomer: UserType | null = null;
  private initialValues: NormalizedCustomerValue | null = null;

  constructor(
    private customersService: CustomersService,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    const sub = this.customersService.getCustomers().subscribe({
      error: () =>
        this.showAlert(
          'error',
          'Échec du chargement',
          'Impossible de récupérer la liste des clients. Veuillez réessayer plus tard.'
        ),
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
  }

  openCustomerModal(modal: TemplateRef<any>, customer?: UserType): void {
    this.prepareFormForModal(customer);
    this.modalService.open(modal, { centered: true, size: 'lg' });
  }

  submit(modal?: any): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showAlert(
        'error',
        'Formulaire incomplet',
        'Veuillez vérifier les champs avant de continuer.'
      );
      return;
    }

    const normalized = this.normalizeFormValues(this.form.value);
    const initial = this.initialValues ?? normalized;
    const isEdit = !!this.selectedCustomer?.id;

    if (isEdit) {
      const changes = FormHelper.getChangedValues(normalized, initial);
      if (Object.keys(changes).length === 0) {
        this.showAlert('info', 'Aucune modification détectée', '');
        this.isButtonDisabled = true;
        return;
      }
      const sub = this.customersService
        .updateCustomer(
          this.selectedCustomer!.id,
          changes as CustomerUpdatePayload
        )
        .subscribe({
          next: () => {
            this.showAlert(
              'success',
              'Client mis à jour',
              'Les informations ont été mises à jour avec succès.'
            );
            this.resetFormState();
            modal?.close();
          },
          error: (err) =>
            this.showAlert(
              'error',
              'Échec de la mise à jour',
              err?.error?.message ||
                'Une erreur est survenue lors de la mise à jour.'
            ),
        });
      this.subscriptions.add(sub);
      return;
    }

    const sub = this.customersService
      .createCustomer(normalized as CustomerCreatePayload)
      .subscribe({
        next: () => {
          this.showAlert(
            'success',
            'Client créé',
            'Le client a été ajouté avec succès.'
          );
          this.resetFormState();
          modal?.close();
        },
        error: (err) =>
          this.showAlert(
            'error',
            'Échec de la création',
            err?.error?.message ||
              'Une erreur est survenue lors de la création du client.'
          ),
      });
    this.subscriptions.add(sub);
  }

  deleteCustomer(customer: UserType): void {
    if (!customer?.id) {
      return;
    }
    Swal.fire({
      title: 'Êtes-vous sûr ? ',
      text: `Voulez-vous supprimer "${customer.firstName} ${customer.lastName}" ? Cette action est irréversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.customersService
          .deleteCustomer(customer.id)
          .subscribe({
            next: () =>
              this.showAlert(
                'success',
                'Client supprimé',
                `"${customer.firstName} ${customer.lastName}" a été supprimé avec succès.`
              ),
            error: (err) =>
              this.showAlert(
                'error',
                'Échec de la suppression',
                err?.error?.message ||
                  'Une erreur est survenue lors de la suppression du client.'
              ),
          });
        this.subscriptions.add(sub);
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
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
      firstName: ['', [Validators.required, Validators.pattern(/\S+/)]],
      lastName: ['', [Validators.required, Validators.pattern(/\S+/)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['CUSTOMER', Validators.required],
      phone: this.fb.group({
        countryCode: [
          '216',
          [Validators.required, Validators.pattern(/^[0-9]+$/)],
        ],
        number: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      }),
    });
  }

  private prepareFormForModal(customer?: UserType): void {
    this.editing = !!customer;
    this.selectedCustomer = customer ?? null;
    this.form.reset(this.getFormResetValue(customer));
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.initialValues = this.normalizeFormValues(this.form.value);
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
  }

  private getFormResetValue(customer?: UserType) {
    const normalizedCode = (customer?.phone?.countryCode ?? '216')
      .toString()
      .replace(/^\+/, '')
      .replace(/\s+/g, '');
    const normalizedNumber = (customer?.phone?.number ?? '').replace(
      /\s+/g,
      ''
    );
    return {
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      email: customer?.email ?? '',
      role: customer?.role ?? 'CUSTOMER',
      phone: {
        countryCode: normalizedCode || '216',
        number: normalizedNumber,
      },
    };
  }

  private normalizeFormValues(value: any): NormalizedCustomerValue {
    const firstName = (value?.firstName ?? '').trim();
    const lastName = (value?.lastName ?? '').trim();
    const email = (value?.email ?? '').trim();
    const role = value?.role ?? 'CUSTOMER';
    const phone: PhoneType = {
      countryCode: (value?.phone?.countryCode ?? '216')
        .toString()
        .replace(/^\+/, '')
        .replace(/\s+/g, '')
        .trim(),
      number: (value?.phone?.number ?? '').replace(/\s+/g, '').trim(),
    };
    return { firstName, lastName, email, role, phone };
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.form.valueChanges.subscribe((values) => {
      const normalized = this.normalizeFormValues(values);
      this.isButtonDisabled = isEqual(normalized, this.initialValues);
    });
  }

  private resetFormState(): void {
    this.editing = false;
    this.selectedCustomer = null;
    this.form.reset(this.getFormResetValue());
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.formChangesSub?.unsubscribe();
    this.initialValues = this.normalizeFormValues(this.form.value);
    this.isButtonDisabled = true;
  }
}
