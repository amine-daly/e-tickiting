import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
} from 'rxjs';
import { isEqual, values } from 'lodash';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

import { FormHelper } from 'src/app/core/helpers/form-helper';
import { MenuComponent } from 'src/app/_metronic/kt/components';
import { RoleEnum, UserType } from 'src/app/core/models/user-type';
import {
  CustomersService,
  CustomerCreatePayload,
  CustomerQueryOptions,
  CustomerUpdatePayload,
} from '../customers.service';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthRoutingModule } from 'src/app/modules/auth/auth-routing.module';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    NgbModalModule,
    TranslateModule,
    AuthRoutingModule,
    PaginationComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class CustomersListComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private formChangesSub?: Subscription;
  private readonly searchTermChanges$ = new Subject<string>();
  private subscriptions = new Subscription();
  private selectedCustomer: UserType | null = null;

  users$ = this.customersService.users$;
  loading$ = this.customersService.loading$;
  pagination$ = this.customersService.pagination$;

  page = 1;
  pageSize = this.customersService.pageLimit;
  searchTerm = '';
  selectedRole = '';
  exporting = false;

  userForm: FormGroup;
  isButtonDisabled = true;
  roles = values(RoleEnum);
  readonly roleFilterOptions = [
    { value: '', labelKey: 'CUSTOMERS.FILTER.ALL' },
    ...values(RoleEnum).map((role) => ({
      value: role,
      labelKey: `CUSTOMERS.ROLES.${role}`,
    })),
  ];

  constructor(
    private customersService: CustomersService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    this.userForm = this.buildForm();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.searchTermChanges$
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(() => this.loadPage(1)),
    );
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
    this.isButtonDisabled = true;
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.showAlert(
        'error',
        'Formulaire incomplet',
        'Veuillez vérifier les champs avant de continuer.',
      );
      return;
    }

    const isEdit = !!this.selectedCustomer?.id;
    const changes = FormHelper.getChangedValues(
      this.userForm.value,
      this.initialValues,
    );
    if (isEdit) {
      if (Object.keys(changes).length === 0) {
        this.showAlert('info', 'Aucune modification détectée', '');
        return;
      }
      const sub = this.customersService
        .updateCustomer(
          this.selectedCustomer!.id,
          changes as CustomerUpdatePayload,
        )
        .subscribe({
          next: () => {
            this.showAlert(
              'success',
              'Client mis à jour',
              'Les informations ont été mises à jour avec succès.',
            );
            this.resetFormState();
            modal?.close();
            setTimeout(() => MenuComponent.reinitialization(), 50);
          },
          error: (err) =>
            this.showAlert(
              'error',
              'Échec de la mise à jour',
              err?.error?.message ||
                'Une erreur est survenue lors de la mise à jour.',
            ),
        });
      this.subscriptions.add(sub);
      return;
    }

    const sub = this.customersService
      .createCustomer(changes as CustomerCreatePayload)
      .subscribe({
        next: () => {
          this.showAlert(
            'success',
            'Client créé',
            'Le client a été ajouté avec succès.',
          );
          this.resetFormState();
          modal?.close();
          setTimeout(() => MenuComponent.reinitialization(), 50);
        },
        error: (err) =>
          this.showAlert(
            'error',
            'Échec de la création',
            err?.error?.message ||
              'Une erreur est survenue lors de la création du client.',
          ),
      });
    this.subscriptions.add(sub);
  }

  onSearchInput(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.searchTermChanges$.next(searchTerm);
  }

  onRoleChange(role: string): void {
    this.selectedRole = role;
  }

  applyFilters(): void {
    this.loadPage(1);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedRole = '';
    this.loadPage(1);
  }

  async exportCustomers(): Promise<void> {
    if (this.exporting) {
      return;
    }

    this.exporting = true;
    try {
      const customers = await firstValueFrom(
        this.customersService.fetchAllCustomers(this.getActiveFilters()),
      );

      if (!customers.length) {
        this.showAlert(
          'info',
          'Aucun client à exporter',
          'Aucune donnée ne correspond aux filtres actuels.',
        );
        return;
      }

      this.exporting = false;
      this.downloadCsv(customers);
      this.cdr.markForCheck();
    } catch (err) {
      this.showAlert(
        'error',
        "Échec de l'export",
        "Une erreur est survenue lors de l'export des clients.",
      );
    } finally {
      this.exporting = false;
    }
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
                `"${customer.firstName} ${customer.lastName}" a été supprimé avec succès.`,
              ),
            // Ensure KT menu handlers reinitialize after DOM updates
            complete: () =>
              setTimeout(() => MenuComponent.reinitialization(), 50),
            error: (err) =>
              this.showAlert(
                'error',
                'Échec de la suppression',
                err?.error?.message ||
                  'Une erreur est survenue lors de la suppression du client.',
              ),
          });
        this.subscriptions.add(sub);
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.userForm.get(controlName);
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
      role: [RoleEnum.CUSTOMER, Validators.required],
      phone: this.fb.group({
        countryCode: [
          '',
          [Validators.required, Validators.pattern(/^[0-9]+$/)],
        ],
        number: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      }),
    });
  }

  onPageChange(page: number): void {
    this.loadPage(page);
  }

  private loadPage(page: number): void {
    this.page = page;
    this.customersService.pageIndex = page - 1;
    this.customersService.getCustomers(this.getActiveFilters()).subscribe();
  }

  private getActiveFilters(): CustomerQueryOptions {
    return {
      searchTerm: this.searchTerm,
      role: this.selectedRole || undefined,
    };
  }

  private prepareFormForModal(customer?: UserType): void {
    this.selectedCustomer = customer;
    this.userForm.reset(this.getFormResetValue(customer));
    this.userForm.markAsPristine();
    this.userForm.markAsUntouched();
    this.initialValues = this.userForm.value;
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
  }

  private getFormResetValue(customer?: UserType) {
    return {
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      email: customer?.email ?? '',
      role: customer?.role ?? RoleEnum.CUSTOMER,
      phone: {
        countryCode: customer?.phone?.countryCode ?? '',
        number: customer?.phone?.number ?? '',
      },
    };
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.userForm.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(values, this.initialValues);
    });
  }

  private resetFormState(): void {
    this.selectedCustomer = null;
    this.userForm.reset(this.getFormResetValue());
    this.userForm.markAsPristine();
    this.userForm.markAsUntouched();
    this.formChangesSub?.unsubscribe();
    this.initialValues = this.userForm.value;
    this.isButtonDisabled = true;
  }

  private downloadCsv(customers: UserType[]): void {
    const header = [
      'First name',
      'Last name',
      'Email',
      'Phone',
      'Role',
      'Created at',
    ];
    const rows = customers.map((customer) => [
      this.escapeCsvValue(customer.firstName),
      this.escapeCsvValue(customer.lastName),
      this.escapeCsvValue(customer.email || ''),
      this.escapeCsvValue(this.formatPhone(customer.phone)),
      this.escapeCsvValue(customer.role || ''),
      this.escapeCsvValue(this.formatExportDate(customer.createdAt)),
    ]);

    const csv = [header, ...rows].map((row) => row.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `customers-export-${this.formatExportDate(new Date().toISOString())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsvValue(value: string): string {
    const normalized = value ?? '';
    if (/[,"\n\r]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  }

  private formatPhone(phone: UserType['phone']): string {
    if (!phone?.countryCode || !phone?.number) {
      return '';
    }

    return `+${phone.countryCode} ${phone.number}`;
  }

  private formatExportDate(value?: string | null): string {
    if (!value) {
      return '';
    }

    return new Date(value).toISOString().replace(/[:.]/g, '-');
  }
}
