import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { isEqual } from 'lodash';
import { combineLatest, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { AlertService } from '../../core/services/alert.service';
import { FormHelper } from '../../core/helpers/form-helper';
import { RouteType, RouteCoefficient } from '../../core/models/route.model';
import { PlaceType } from '../../core/models/place-type';
import { PlacesService } from '../places/places.service';
import {
  RoutesService,
  RouteCreatePayload,
  RouteUpdatePayload,
  CoefficientCreatePayload,
  CoefficientUpdatePayload,
} from './routes.service';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';

@Component({
  selector: 'app-routes-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    NgbModule,
    TranslateModule,
    FlatpickrDirective,
  ],
  providers: [provideFlatpickrDefaults()],
  templateUrl: './routes-list.component.html',
  styleUrls: ['./routes-list.component.scss'],
})
export class RoutesListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private selectedRoute: RouteType | null = null;
  private selectedCoefficient: RouteCoefficient | null = null;
  private initialRouteValues: RouteCreatePayload | RouteUpdatePayload | null =
    null;
  private initialCoeffValues:
    | CoefficientCreatePayload
    | CoefficientUpdatePayload
    | null = null;

  // Route form
  routeForm: FormGroup;
  editingRoute = false;
  isRouteButtonDisabled = true;

  // Coefficient form
  coeffForm: FormGroup;
  editingCoeff = false;
  isCoeffButtonDisabled = true;

  // Data
  routes$ = this.routesService.routes$;
  coefficients$ = this.routesService.coefficients$;
  loading$ = this.routesService.loading$;
  places$ = this.placesService.places$;

  // Filtered places for origin/destination
  private allPlaces: PlaceType[] = [];
  originPlaceOptions: PlaceType[] = [];
  destinationPlaceOptions: PlaceType[] = [];

  // Active tab
  activeTab: 'routes' | 'coefficients' = 'routes';

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private modalService: NgbModal,
    private routesService: RoutesService,
    private placesService: PlacesService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadData();

    // Keep cached places for filtering
    const sub = this.places$.subscribe((places) => {
      this.allPlaces = Array.isArray(places) ? places : [];
      this.recomputePlaceOptions();
    });
    this.subscriptions.add(sub);
  }

  loadData(): void {
    const sub = combineLatest([
      this.routesService.getRoutes(),
      this.routesService.getGlobalCoefficients(),
      this.placesService.getPlaces(),
    ]).subscribe({
      error: () => this.alert.error(this.t('ROUTES.MESSAGES.LOAD_ERROR')),
    });
    this.subscriptions.add(sub);
  }

  // ==================== ROUTE MODAL ====================

  openRouteModal(modal: TemplateRef<any>, route?: RouteType): void {
    this.selectedRoute = route ?? null;
    this.editingRoute = !!route;

    this.routeForm = this.fb.group({
      originId: [route?.origin?.id || null, Validators.required],
      destinationId: [route?.destination?.id || null, Validators.required],
      fare: [route?.fare || '', [Validators.required, Validators.min(0.001)]],
      rank: [route?.rank || 0],
      active: [route?.active ?? true],
    });

    this.initialRouteValues = this.routeForm.value;
    this.isRouteButtonDisabled = true;

    // Subscribe to form changes for button state
    const sub = this.routeForm.valueChanges.subscribe((values) => {
      this.isRouteButtonDisabled = isEqual(this.initialRouteValues, values);
      this.recomputePlaceOptions();
    });
    this.subscriptions.add(sub);

    // Subscribe to origin/destination changes for mutual exclusion
    this.routeForm.get('originId')?.valueChanges.subscribe((originId) => {
      const destinationId = this.routeForm.get('destinationId')?.value;
      if (originId && destinationId && originId === destinationId) {
        this.routeForm
          .get('destinationId')
          ?.setValue(null, { emitEvent: false });
      }
      this.recomputePlaceOptions();
    });

    this.routeForm
      .get('destinationId')
      ?.valueChanges.subscribe((destinationId) => {
        const originId = this.routeForm.get('originId')?.value;
        if (originId && destinationId && originId === destinationId) {
          this.routeForm.get('originId')?.setValue(null, { emitEvent: false });
        }
        this.recomputePlaceOptions();
      });

    this.recomputePlaceOptions();
    this.modalService.open(modal, { size: 'lg', centered: true });
  }

  submitRoute(modal?: any): void {
    if (this.routeForm.invalid) {
      this.routeForm.markAllAsTouched();
      return;
    }

    this.isRouteButtonDisabled = true;
    const changes = FormHelper.getChangedValues(
      this.routeForm.value,
      this.initialRouteValues
    );

    const isEdit = !!this.selectedRoute?.id;
    const request$ = isEdit
      ? this.routesService.updateRoute(
          this.selectedRoute!.id!,
          changes as RouteUpdatePayload
        )
      : this.routesService.createRoute(
          this.routeForm.value as RouteCreatePayload
        );

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.t(
            isEdit
              ? 'ROUTES.MESSAGES.UPDATE_SUCCESS'
              : 'ROUTES.MESSAGES.CREATE_SUCCESS'
          )
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.t(
            isEdit
              ? 'ROUTES.MESSAGES.UPDATE_ERROR'
              : 'ROUTES.MESSAGES.CREATE_ERROR'
          )
        );
        this.isRouteButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  deleteRoute(route: RouteType): void {
    if (!route.id) return;

    Swal.fire({
      title: this.t('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.t('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.t('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.t('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.routesService.deleteRoute(route.id!).subscribe({
          next: () =>
            this.alert.success(this.t('ROUTES.MESSAGES.DELETE_SUCCESS')),
          error: () => this.alert.error(this.t('ROUTES.MESSAGES.DELETE_ERROR')),
        });
        this.subscriptions.add(sub);
      }
    });
  }

  // ==================== COEFFICIENT MODAL ====================

  openCoeffModal(modal: TemplateRef<any>, coeff?: RouteCoefficient): void {
    this.selectedCoefficient = coeff ?? null;
    this.editingCoeff = !!coeff;

    this.coeffForm = this.fb.group({
      routeId: [coeff?.routeId || null], // null for global
      startDate: [coeff?.startDate || '', Validators.required],
      endDate: [coeff?.endDate || '', Validators.required],
      coefficient: [
        coeff?.coefficient || 1,
        [Validators.required, Validators.min(0.1)],
      ],
      name: [coeff?.name || ''],
      priority: [coeff?.priority || 0, Validators.min(0)],
      active: [coeff?.active ?? true],
    });

    this.initialCoeffValues = this.coeffForm.value;
    this.isCoeffButtonDisabled = true;

    const sub = this.coeffForm.valueChanges.subscribe((values) => {
      this.isCoeffButtonDisabled = isEqual(this.initialCoeffValues, values);
    });
    this.subscriptions.add(sub);

    this.modalService.open(modal, { size: 'lg', centered: true });
  }

  submitCoeff(modal?: any): void {
    if (this.coeffForm.invalid) {
      this.coeffForm.markAllAsTouched();
      return;
    }

    this.isCoeffButtonDisabled = true;
    const changes = FormHelper.getChangedValues(
      this.coeffForm.value,
      this.initialCoeffValues
    );

    // Format dates
    const payload: any = { ...changes };
    if (payload.startDate && typeof payload.startDate !== 'string') {
      payload.startDate = this.formatDate(payload.startDate);
    }
    if (payload.endDate && typeof payload.endDate !== 'string') {
      payload.endDate = this.formatDate(payload.endDate);
    }

    const isEdit = !!this.selectedCoefficient?.id;
    const request$ = isEdit
      ? this.routesService.updateCoefficient(
          this.selectedCoefficient!.id!,
          payload as CoefficientUpdatePayload
        )
      : this.routesService.createCoefficient(
          this.coeffForm.value as CoefficientCreatePayload
        );

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.t(
            isEdit
              ? 'ROUTES.MESSAGES.COEFF_UPDATE_SUCCESS'
              : 'ROUTES.MESSAGES.COEFF_CREATE_SUCCESS'
          )
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.t(
            isEdit
              ? 'ROUTES.MESSAGES.COEFF_UPDATE_ERROR'
              : 'ROUTES.MESSAGES.COEFF_CREATE_ERROR'
          )
        );
        this.isCoeffButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  deleteCoeff(coeff: RouteCoefficient): void {
    if (!coeff.id) return;

    Swal.fire({
      title: this.t('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.t('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.t('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.t('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.routesService.deleteCoefficient(coeff.id!).subscribe({
          next: () =>
            this.alert.success(this.t('ROUTES.MESSAGES.COEFF_DELETE_SUCCESS')),
          error: () =>
            this.alert.error(this.t('ROUTES.MESSAGES.COEFF_DELETE_ERROR')),
        });
        this.subscriptions.add(sub);
      }
    });
  }

  // ==================== HELPERS ====================

  isRouteInvalid(controlName: string): boolean {
    const control = this.routeForm?.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  isCoeffInvalid(controlName: string): boolean {
    const control = this.coeffForm?.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  formatFare(fare: number | undefined): string {
    if (fare === undefined || fare === null) return '-';
    return fare.toFixed(3) + ' TND';
  }

  formatCoefficient(coeff: number | undefined): string {
    if (coeff === undefined || coeff === null) return '-';
    return `x${coeff.toFixed(2)}`;
  }

  private recomputePlaceOptions(): void {
    const all = this.allPlaces || [];
    const originId = this.routeForm?.get('originId')?.value;
    const destinationId = this.routeForm?.get('destinationId')?.value;

    this.originPlaceOptions = all.filter((p) => {
      if (!p?.id) return false;
      if (originId && p.id === originId) return true;
      return !destinationId || p.id !== destinationId;
    });

    this.destinationPlaceOptions = all.filter((p) => {
      if (!p?.id) return false;
      if (destinationId && p.id === destinationId) return true;
      return !originId || p.id !== originId;
    });
  }

  private formatDate(date: Date | string): string {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
