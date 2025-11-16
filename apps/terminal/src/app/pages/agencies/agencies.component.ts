import Swal from 'sweetalert2';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { AgenciesService } from './agencies.service';
import { AlertService } from '../../core/services/alert.service';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { AgencyPhone, AgencyType } from 'src/app/core/models/trip.model';

@Component({
  selector: 'app-agencies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KeeniconComponent],
  templateUrl: './agencies.component.html',
  styleUrls: ['./agencies.component.scss'],
})
export class AgenciesComponent implements OnInit, OnDestroy {
  agencies$ = this.agenciesService.agencies$;
  loadingAgencies$ = this.agenciesService.loadingAgencies$;
  error$ = this.agenciesService.error$;

  form: FormGroup;
  editing = false;

  private subscriptions = new Subscription();
  private currentAgency: AgencyType | null = null;

  constructor(
    private alert: AlertService,
    private modalService: NgbModal,
    private agenciesService: AgenciesService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      id: [null],
      name: ['', [Validators.required, Validators.pattern(/\S+/)]],
      address: ['', [Validators.required, Validators.pattern(/\S+/)]],
      email: ['', [Validators.email]],
      phoneCountryCode: [
        '216',
        [Validators.required, Validators.pattern(/^[0-9]+$/)],
      ],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
    });
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

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  openCreate(agencyModal: any) {
    this.editing = false;
    this.currentAgency = null;
    this.form.reset({
      id: null,
      name: '',
      address: '',
      email: '',
      phoneCountryCode: '216',
      phoneNumber: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalService.open(agencyModal, { size: 'lg' });
  }

  submit(modal?: any) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Veuillez vérifier le formulaire avant de continuer');
      return;
    }

    const { id, name, address, email, phoneCountryCode, phoneNumber } =
      this.form.value;

    const trimmedName = (name ?? '').trim();
    const trimmedAddress = (address ?? '').trim();
    const trimmedEmail = (email ?? '').trim();
    const phone = this.buildPhonePayload(phoneCountryCode, phoneNumber);

    if (this.editing && id) {
      const changes: Partial<AgencyType> = {};

      if (trimmedName !== (this.currentAgency?.name ?? '')) {
        changes.name = trimmedName;
      }
      if (trimmedAddress !== (this.currentAgency?.address ?? '')) {
        changes.address = trimmedAddress;
      }
      const currentEmail = this.currentAgency?.email ?? '';
      if (trimmedEmail !== currentEmail) {
        changes.email = trimmedEmail || '';
      }

      const currentPhone = this.currentAgency?.phone;
      if (
        !currentPhone ||
        currentPhone.countryCode !== phone.countryCode ||
        currentPhone.number !== phone.number
      ) {
        changes.phone = phone;
      }

      if (Object.keys(changes).length === 0) {
        this.alert.info('Aucune modification détectée');
        return;
      }

      this.agenciesService.update(id, changes).subscribe({
        next: () => {
          this.alert.success('Agence modifiée avec succès');
          this.editing = false;
          this.currentAgency = null;
          this.form.reset({
            id: null,
            name: '',
            address: '',
            email: '',
            phoneCountryCode: '216',
            phoneNumber: '',
          });
          this.form.markAsPristine();
          this.form.markAsUntouched();
          modal?.close();
        },
        error: () => this.alert.error("Échec de la modification de l'agence"),
      });
      return;
    }

    const payload: AgencyType = {
      name: trimmedName,
      address: trimmedAddress,
      email: trimmedEmail || '',
      phone,
    };

    this.agenciesService.create(payload).subscribe({
      next: () => {
        this.alert.success('Agence créée avec succès');
        this.editing = false;
        this.currentAgency = null;
        this.form.reset({
          id: null,
          name: '',
          address: '',
          email: '',
          phoneCountryCode: '216',
          phoneNumber: '',
        });
        this.form.markAsPristine();
        this.form.markAsUntouched();
        modal?.close();
      },
      error: () => this.alert.error("Échec de la création de l'agence"),
    });
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
        this.agenciesService.delete(agency.id).subscribe({
          next: () => {
            this.alert.success('Agence supprimée avec succès');
          },
          error: () => this.alert.error("Échec de la suppression de l'agence"),
        });
      }
    });
  }

  openEdit(agencyModal: any, agency: AgencyType) {
    this.editing = true;
    this.currentAgency = agency;
    const normalizedCode = (agency.phone?.countryCode ?? '216')
      .replace(/^\+/, '')
      .replace(/\s+/g, '');
    const normalizedNumber = (agency.phone?.number ?? '').replace(/\s+/g, '');
    this.form.reset({
      id: agency.id ?? null,
      name: agency.name,
      address: agency.address,
      email: agency.email ?? '',
      phoneCountryCode: normalizedCode || '216',
      phoneNumber: normalizedNumber,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalService.open(agencyModal, { size: 'lg' });
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

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
