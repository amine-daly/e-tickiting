import Swal from 'sweetalert2';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { FormHelper } from '../../core/helpers/form-helper';
import {
  AgenciesService,
  AgencyCreatePayload,
  AgencyUpdatePayload,
} from './agencies.service';
import { AlertService } from '../../core/services/alert.service';
import { AgencyPhone, AgencyType } from 'src/app/core/models/trip.model';
import { isEqual } from 'lodash';

type NormalizedAgencyValue = {
  name: string;
  address: string;
  email: string;
  phone: AgencyPhone;
  template: string;
};

@Component({
  selector: 'app-agencies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agencies.component.html',
  styleUrls: ['./agencies.component.scss'],
})
export class AgenciesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  error$ = this.agenciesService.error$;
  agencies$ = this.agenciesService.agencies$;
  loadingAgencies$ = this.agenciesService.loadingAgencies$;

  form: FormGroup;
  isButtonDisabled = true;
  defaultTemplate: string | null = null;
  defaultTemplateLoading = false;

  private subscriptions = new Subscription();
  private formChangesSub?: Subscription;
  private selectedAgency: AgencyType | null = null;
  private initialValues: NormalizedAgencyValue | null = null;
  private defaultTemplateCallbacks: Array<() => void> = [];

  templateForm: FormGroup | undefined;
  templateModalAgency: AgencyType | null = null;
  showPreview: boolean = false;
  initialTemplateValues: any;
  isTemplateButtonDisabled = true;

  constructor(
    private alert: AlertService,
    private modalService: NgbModal,
    private agenciesService: AgenciesService,
    private fb: FormBuilder
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    const loadSub = this.agenciesService.getAgencies().subscribe({
      error: () =>
        this.alert.error(
          'Impossible de charger les agences. Veuillez réessayer plus tard.'
        ),
    });
    this.subscriptions.add(loadSub);
  }

  openTemplateModal(templateModal: TemplateRef<any>, agency: AgencyType): void {
    this.isTemplateButtonDisabled = true;
    this.templateModalAgency = agency;
    this.ensureDefaultTemplateLoaded(() => {
      this.templateForm = this.fb.group({
        template: [agency?.template ?? '', [Validators.required]],
      });
      this.initialTemplateValues = this.templateForm?.value;
      this.templateForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((values) => {
          this.isTemplateButtonDisabled = isEqual(
            values,
            this.initialTemplateValues
          );
        });
      this.showPreview = false;
    });
    this.modalService.open(templateModal, { size: 'lg' });
  }

  applyDefaultTemplateToForm(): void {
    if (this.defaultTemplate && this.templateForm) {
      this.templateForm.patchValue({ template: this.defaultTemplate });
      this.templateForm.markAsDirty();
    }
  }

  submitTemplate(modal: any): void {
    const newTemplate = FormHelper.getChangedValues(
      this.templateForm.value,
      this.initialTemplateValues
    );
    console.log(22);
    this.agenciesService
      .updateAgency(this.templateModalAgency.id, { template: newTemplate })
      .subscribe({
        next: () => {
          this.alert.success('Modèle mis à jour avec succès');
          modal?.close();
        },
        error: () => this.alert.error('Échec de la mise à jour du modèle'),
      });
  }

  openAgencyModal(agencyModal: TemplateRef<any>, agency?: AgencyType): void {
    this.prepareFormForModal(agency);
    this.modalService.open(agencyModal, { size: 'lg' });
  }

  applyDefaultTemplate(): void {
    if (this.defaultTemplate) {
      this.form.patchValue({ template: this.defaultTemplate });
      this.form.markAsDirty();
      return;
    }
    this.ensureDefaultTemplateLoaded(() => {
      if (this.defaultTemplate) {
        this.form.patchValue({ template: this.defaultTemplate });
        this.form.markAsDirty();
      }
    });
  }

  submit(modal?: any) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Veuillez vérifier le formulaire avant de continuer');
      return;
    }

    const normalized = this.normalizeFormValues(this.form.value);
    const initial = this.initialValues ?? normalized;
    const isEdit = !!this.selectedAgency?.id;

    if (isEdit) {
      const changes = FormHelper.getChangedValues(normalized, initial);
      if (Object.keys(changes).length === 0) {
        this.alert.info('Aucune modification détectée');
        this.isButtonDisabled = true;
        return;
      }

      const sub = this.agenciesService
        .updateAgency(this.selectedAgency!.id!, changes as AgencyUpdatePayload)
        .subscribe({
          next: () => {
            this.alert.success('Agence modifiée avec succès');
            this.resetFormState();
            modal?.close();
          },
          error: () => this.alert.error("Échec de la modification de l'agence"),
        });
      this.subscriptions.add(sub);
      return;
    }

    const sub = this.agenciesService
      .createAgency(normalized as AgencyCreatePayload)
      .subscribe({
        next: () => {
          this.alert.success('Agence créée avec succès');
          this.resetFormState();
          modal?.close();
        },
        error: () => this.alert.error("Échec de la création de l'agence"),
      });
    this.subscriptions.add(sub);
  }

  deleteAgency(agency: AgencyType) {
    if (!agency.id) return;
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer !',
      cancelButtonText: 'Annuler',
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.agenciesService.deleteAgency(agency.id).subscribe({
          next: () => {
            this.alert.success('Agence supprimée avec succès');
          },
          error: () => this.alert.error("Échec de la suppression de l'agence"),
        });
        this.subscriptions.add(sub);
      }
    });
  }

  formatPhone(phone?: AgencyPhone | null): string {
    if (!phone || (!phone.countryCode && !phone.number)) {
      return '-';
    }
    if (!phone.countryCode) {
      return phone.number;
    }
    if (!phone.number) {
      return `+${phone.countryCode}`;
    }
    return `+${phone.countryCode} ${phone.number}`;
  }

  private buildPhonePayload(countryCode: string, number: string): AgencyPhone {
    const trimmedNumber = (number ?? '').replace(/\s+/g, '').trim();
    const trimmedCode =
      (countryCode ?? '').replace(/^\+/, '').replace(/\s+/g, '').trim() ||
      '216';
    return {
      countryCode: trimmedCode,
      number: trimmedNumber,
    };
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      id: [null],
      name: ['', [Validators.required, Validators.pattern(/\S+/)]],
      address: ['', [Validators.required, Validators.pattern(/\S+/)]],
      email: ['', [Validators.email]],
      phoneCountryCode: [
        '216',
        [Validators.required, Validators.pattern(/^[0-9]+$/)],
      ],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      template: [''],
    });
  }

  private prepareFormForModal(agency?: AgencyType): void {
    this.selectedAgency = agency ?? null;
    this.form.reset(this.getFormResetValue(agency));
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.initialValues = this.normalizeFormValues(this.form.value);
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
  }

  private getFormResetValue(agency?: AgencyType) {
    const normalizedCode = (agency?.phone?.countryCode ?? '216')
      .replace(/^\+/, '')
      .replace(/\s+/g, '');
    const normalizedNumber = (agency?.phone?.number ?? '').replace(/\s+/g, '');
    return {
      id: agency?.id ?? null,
      name: agency?.name ?? '',
      address: agency?.address ?? '',
      email: agency?.email ?? '',
      phoneCountryCode: normalizedCode || '216',
      phoneNumber: normalizedNumber,
      template: agency?.template ?? '',
    };
  }

  private normalizeFormValues(value: any): NormalizedAgencyValue {
    const name = (value?.name ?? '').trim();
    const address = (value?.address ?? '').trim();
    const email = (value?.email ?? '').trim();
    const phone = this.buildPhonePayload(
      value?.phoneCountryCode,
      value?.phoneNumber
    );
    const template = typeof value?.template === 'string' ? value.template : '';
    return { name, address, email, phone, template };
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.form.valueChanges.subscribe((values) => {
      const normalized = this.normalizeFormValues(values);
      this.isButtonDisabled = isEqual(normalized, this.initialValues);
    });
  }

  private resetFormState(): void {
    this.selectedAgency = null;
    this.form.reset(this.getFormResetValue());
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.formChangesSub?.unsubscribe();
    this.initialValues = this.normalizeFormValues(this.form.value);
    this.isButtonDisabled = true;
  }

  private ensureDefaultTemplateLoaded(onReady?: () => void): void {
    if (this.defaultTemplate) {
      onReady?.();
      return;
    }
    if (this.defaultTemplateLoading) {
      if (onReady) {
        this.defaultTemplateCallbacks.push(onReady);
      }
      return;
    }
    if (onReady) {
      this.defaultTemplateCallbacks.push(onReady);
    }
    this.defaultTemplateLoading = true;
    const sub = this.agenciesService.getDefaultTemplate().subscribe({
      next: (template) => {
        this.defaultTemplate = template;
        this.defaultTemplateLoading = false;
        const callbacks = [...this.defaultTemplateCallbacks];
        this.defaultTemplateCallbacks = [];
        callbacks.forEach((cb) => cb());
      },
      error: () => {
        this.defaultTemplateLoading = false;
        this.alert.error('Impossible de charger le modèle par défaut');
        this.defaultTemplateCallbacks = [];
      },
    });
    this.subscriptions.add(sub);
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
  }
}
