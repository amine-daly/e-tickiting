import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { CustomersService } from './customers.service';
import { UserType } from 'src/app/modules/auth/models/user-type';
import { Subject, takeUntil } from 'rxjs';
import { isEqual } from 'lodash';
import { FormHelper } from 'src/app/core/helpers/form-helper';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModalModule, ReactiveFormsModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
})
export class CustomersComponent implements OnInit {
  successModal(title: string, text: string) {
    Swal.fire({
      icon: 'success',
      title,
      text,
      timer: 2000,
      showConfirmButton: false,
    });
    this.modalService.dismissAll();
  }

  errorModal(title: string, text: string) {
    Swal.fire({
      icon: 'error',
      title,
      text,
    });
    this.modalService.dismissAll();
  }
  destroy$ = new Subject<boolean>();
  error: string | null = null;
  userForm: FormGroup;
  selectedCustomer: any = null;
  loading$ = this.customersService.loading$;
  users$ = this.customersService.users$;
  initial: any;
  isButtonDisabled: boolean = true;

  constructor(
    private customersService: CustomersService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit() {}

  openUserModal(modal: any, customer: UserType) {
    this.selectedCustomer = customer;
    this.userForm = this.formBuilder.group({
      firstName: [customer?.firstName || ''],
      lastName: [customer?.lastName || ''],
      email: [customer?.email || ''],
      role: [customer?.role || 'CUSTOMER'],
      phone: this.formBuilder.group({
        countryCode: [216],
        number: [customer?.phone?.number || ''],
      }),
    });
    this.initial = this.userForm.value;
    this.userForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isButtonDisabled = isEqual(this.userForm.value, this.initial);
    });
    this.modalService.open(modal, { centered: true, size: 'lg' });
  }

  submit() {
    const changed = FormHelper.getChangedValues(
      this.userForm.value,
      this.initial
    );
    if (this.selectedCustomer) {
      this.customersService
        .update(this.selectedCustomer?.id, changed)
        .subscribe({
          next: () => {
            this.successModal(
              'User updated',
              'User has been updated successfully.'
            );
          },
          error: (err) => {
            this.errorModal(
              'Update failed',
              err?.error?.message ||
                'An error occurred while updating the user.'
            );
          },
        });
    } else {
      this.customersService.create(changed).subscribe({
        next: () => {
          this.successModal(
            'User created',
            'User has been created successfully.'
          );
        },
        error: (err) => {
          this.errorModal(
            'Create failed',
            err?.error?.message || 'An error occurred while creating the user.'
          );
        },
      });
    }
  }

  deleteCustomer(customer: any) {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you really want to delete user "${customer?.firstName} ${customer?.lastName}"? This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete user',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.customersService.delete(customer?.id).subscribe({
          next: () => {
            this.successModal(
              'User deleted',
              `User "${customer?.firstName} ${customer?.lastName}" has been deleted.`
            );
          },
          error: (err) => {
            this.errorModal(
              'Delete failed',
              err?.error?.message ||
                'An error occurred while deleting the user.'
            );
          },
        });
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next(true);
    this.destroy$.complete();
  }
}
