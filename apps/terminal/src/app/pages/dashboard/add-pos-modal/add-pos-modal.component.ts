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
import { Subscription } from 'rxjs';
import { isEqual } from 'lodash';

import { BusinessProfileService } from '../../business-profile/business-profile/business-profile.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { FormHelper } from 'src/app/core/helpers/form-helper';

@Component({
  selector: 'app-add-pos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './add-pos-modal.component.html',
  styleUrls: ['./add-pos-modal.component.scss'],
})
export class AddPosModalComponent implements OnInit, OnDestroy {
  posForm: FormGroup;
  isSubmitting = false;
  isButtonDisabled = true;
  private formChangesSub?: Subscription;
  private initialValues: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private profileService: BusinessProfileService,
    private alert: AlertService,
    private translate: TranslateService,
  ) {
    this.posForm = this.buildForm();
  }

  ngOnInit(): void {
    this.initialValues = this.posForm.value;
    this.formChangesSub = this.posForm.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(values, this.initialValues);
    });
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required]],
      subtitle: [''],
      email: ['', [Validators.email]],
      picture: this.fb.group({
        baseUrl: [''],
        path: [''],
      }),
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.posForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.posForm.invalid) {
      this.posForm.markAllAsTouched();
      return;
    }

    const current = this.posForm.value;
    const changes = FormHelper.getChangedValues(
      current,
      this.initialValues || {},
    );

    if (Object.keys(changes).length === 0) {
      this.posForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.profileService.createPos(changes).subscribe({
      next: (createdPos) => {
        this.alert.success(
          this.translate.instant('DASHBOARD.POS.MESSAGES.CREATE_SUCCESS'),
        );
        this.activeModal.close(createdPos);
      },
      error: (err) => {
        this.alert.error(
          err?.error?.message ||
            this.translate.instant('DASHBOARD.POS.MESSAGES.CREATE_ERROR'),
        );
        this.isSubmitting = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
  }

  dismiss(): void {
    this.activeModal.dismiss();
  }
}
