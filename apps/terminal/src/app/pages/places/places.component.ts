import { CommonModule } from '@angular/common';
import {
  OnInit,
  OnDestroy,
  Component,
  TemplateRef,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import Swal from 'sweetalert2';
import { isEqual, omit } from 'lodash';
import {
  NgbModal,
  NgbPaginationModule,
  NgbNavModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { GoogleMapsModule } from '@angular/google-maps';
import {
  Subject,
  Subscription,
  take,
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  Observable,
  tap,
} from 'rxjs';

import { StateType } from '../../core/models/state-type';
import {
  PlaceType,
  SubPlaceType,
  PlaceKindEnum,
} from '../../core/models/place-type';
import { FormHelper } from '../../core/helpers/form-helper';
import { CountryType } from '../../core/models/country-type';
import { AlertService } from '../../core/services/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  PlacesService,
  PlaceCreatePayload,
  PlaceUpdatePayload,
  PlaceFilterType,
} from './places.service';
import {
  SubPlacesService,
  SubPlaceCreatePayload,
  SubPlaceUpdatePayload,
} from '../sub-places/sub-places.service';
import { IPagination } from 'src/app/core/models/paginate-model';

@Component({
  selector: 'app-places',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    GoogleMapsModule,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,
    NgbPaginationModule,
    NgbNavModule,
  ],
  templateUrl: './places.component.html',
  styleUrls: ['./places.component.scss'],
})
export class PlacesComponent implements OnInit, OnDestroy {
  private formChangesSub?: Subscription;
  private subscriptions = new Subscription();
  private selectedPlace: PlaceType | null = null;
  private selectedSubPlace: SubPlaceType | null = null;
  private destroy$: Subject<void> = new Subject<void>();
  private initialValues: PlaceCreatePayload | PlaceUpdatePayload | null = null;

  private statesCountry: CountryType;
  private countriesQuery = '';

  // Tabs
  activeTab: 'places' | 'subPlaces' = 'places';

  statesLoading = false;
  countriesLoading = false;

  placesSearch: string = '';
  placesKindFilter: PlaceKindEnum;
  placesParentIdFilter: string = '';
  loading = true;
  subPlacesLoading = false;
  form: FormGroup;
  subPlaceForm: FormGroup;
  editing = false;
  editingSubPlace = false;
  isButtonDisabled = true;
  isSubPlaceButtonDisabled = true;
  error: string | null = null;
  subPlacesError: string | null = null;
  places$ = this.placesService.places$;
  subPlaces$ = this.subPlacesService.subPlaces$;
  subPlacePosition: google.maps.LatLngLiteral | null = null;

  // For dropdowns
  countries: CountryType[] = [];
  states: StateType[] = [];
  parentPlaces: PlaceType[] = []; // CITY places for selecting parent
  // expose enum to template
  PlaceKind = PlaceKindEnum;

  statesSearchInput$: Subject<string> = new Subject<string>();
  countriesSearchInput$: Subject<string> = new Subject<string>();
  placesSearchInput$: Subject<string> = new Subject<string>();
  subPlacesSearchInput$: Subject<string> = new Subject<string>();
  pagination: IPagination;
  subPlacesPagination: IPagination;
  page = 0;
  subPlacesPage = 0;
  pageChanged: boolean;
  subPlacesPageChanged: boolean;
  infinitePlaces$ = this.placesService.infinitePlaces$;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private cd: ChangeDetectorRef,
    private modalService: NgbModal,
    private translate: TranslateService,
    public placesService: PlacesService,
    public subPlacesService: SubPlacesService
  ) {
    this.statesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.placesService.resetStates();
          this.states = [];
          this.placesService.statesSearchString = searchString;
          return this.placesService.getStatesByCountry(this.statesCountry?.id);
        })
      )
      .subscribe(() => {
        this.cd.markForCheck();
      });

    this.countriesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.countries = [];
          this.placesService.countriesSearchString = searchString;
          return this.placesService.getCountries();
        })
      )
      .subscribe(() => {
        this.cd.markForCheck();
      });

    this.placesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.placesService.placesPageIndex = 0;
          this.loading = true;
          this.placesService.placesSearchString = searchString;
          return this.placesService.getPlaces();
        })
      )
      .subscribe(() => {
        this.loading = false;
        this.cd.markForCheck();
      });

    this.subPlacesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        tap((searchString) => {
          this.subPlacesService.pageIndex = 0;
          this.subPlacesService.searchString = searchString;
          this.loadSubPlaces();
        })
      )
      .subscribe();

    this.placesService.states$
      .pipe(takeUntil(this.destroy$))
      .subscribe((states) => {
        this.states = [...this.states, ...(states || [])];
        this.cd.detectChanges();
      });

    this.placesService.countries$
      .pipe(takeUntil(this.destroy$))
      .subscribe((countries) => {
        this.countries = countries;
        this.cd.detectChanges();
      });
  }

  ngOnInit(): void {
    this.loadPlaces();
    this.placesService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pagination: IPagination) => {
        if (!pagination) return;
        this.pagination = {
          length: pagination?.length,
          page: this.placesService.placesPageIndex || 0,
          size: this.placesService.placesPageLimit,
          lastPage: pagination?.length - 1,
          startIndex:
            (this.placesService.placesPageIndex || 0) *
            this.placesService.placesPageLimit,
          endIndex: Math.min(
            ((this.placesService.placesPageIndex || 0) + 1) *
              this.placesService.placesPageLimit -
              1,
            pagination.length - 1
          ),
        };
        this.cd.markForCheck();
      });

    this.subPlacesService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pagination: IPagination) => {
        if (!pagination) return;
        this.subPlacesPagination = {
          length: pagination?.length,
          page: this.subPlacesService.pageIndex || 0,
          size: this.subPlacesService.pageLimit,
          lastPage: pagination?.length - 1,
          startIndex:
            (this.subPlacesService.pageIndex || 0) *
            this.subPlacesService.pageLimit,
          endIndex: Math.min(
            ((this.subPlacesService.pageIndex || 0) + 1) *
              this.subPlacesService.pageLimit -
              1,
            pagination.length - 1
          ),
        };
        this.cd.markForCheck();
      });

    /* this.places$.pipe(takeUntil(this.destroy$)).subscribe((places) => {
      this.parentPlaces = places.filter(
        (p) => p.kind === PlaceKindEnum.CITY || !p.kind
      );
    }); */
  }

  onTabChange(tab: 'places' | 'subPlaces'): void {
    this.activeTab = tab;
    if (tab === 'subPlaces' && !this.subPlacesPagination) {
      this.loadSubPlaces();
    }
  }

  onPageChange(page: number) {
    this.page = page;
    if (this.page > 1) {
      this.pageChanged = true;
    }
    this.placesService.placesPageIndex = page - 1;

    if (this.pageChanged) {
      this.loadPlaces();
    }
  }

  onSubPlacesPageChange(page: number) {
    this.subPlacesPage = page;
    if (this.subPlacesPage > 1) {
      this.subPlacesPageChanged = true;
    }
    this.subPlacesService.pageIndex = page - 1;

    if (this.subPlacesPageChanged) {
      this.loadSubPlaces();
    }
  }

  openPlaceModal(placeModal: TemplateRef<any>, place?: PlaceType): void {
    this.loadCountries();
    this.selectedPlace = place ?? null;
    this.editing = !!place;

    this.form = this.buildForm(place);

    const initialCountry = this.form.get('country')?.value;
    this.resetStatesPagination(initialCountry || null);
    if (initialCountry) {
      this.getStatesByCountry();
    }

    this.initialValues = this.form.value;
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
    this.modalService.open(placeModal, { size: 'lg' });
    this.cd.markForCheck();
  }

  // ========== SubPlace Modal ==========
  openSubPlaceModal(
    subPlaceModal: TemplateRef<any>,
    subPlace?: SubPlaceType
  ): void {
    // Ensure parent places are loaded for the dropdown
    // Initialize parent places infinite list (clear and load first page)
    this.placesService.parentPlacesPageIndex = 0;
    this.placesService.infinitePlaces$ = [];
    const initParentSub = this.placesService
      .getParentPlaces()
      .pipe(take(1))
      .subscribe(() => {
        this.cd.detectChanges();
      });
    this.subscriptions.add(initParentSub);
    this.selectedSubPlace = subPlace ?? null;
    this.editingSubPlace = !!subPlace;
    this.subPlacePosition = subPlace?.location?.coordinates
      ? {
          lat: subPlace.location.coordinates[1],
          lng: subPlace.location.coordinates[0],
        }
      : null;

    this.subPlaceForm = this.buildSubPlaceForm(subPlace);

    this.initialValues = this.subPlaceForm.value;
    this.isSubPlaceButtonDisabled = true;
    this.subscribeToSubPlaceFormChanges();
    this.modalService.open(subPlaceModal, { size: 'lg' });
    this.cd.markForCheck();
  }

  loadMoreParentPlaces() {
    this.placesService.isLastPlaces$.pipe(take(1)).subscribe((isLast) => {
      if (!isLast) {
        this.placesService.parentPlacesPageIndex += 1;
        this.placesService.getParentPlaces();
      }
    });
  }

  submitSubPlace(modal?: any): void {
    if (this.subPlaceForm.invalid) {
      this.subPlaceForm.markAllAsTouched();
      return;
    }

    const changes = FormHelper.getChangedValues(
      this.subPlaceForm.value,
      this.initialValues
    );

    const isEdit = !!this.selectedSubPlace?.id;
    let request$:
      | Observable<SubPlaceType>
      | Observable<SubPlaceType>
      | Observable<any>;

    if (isEdit) {
      // Only send changed fields for update
      const payload: SubPlaceUpdatePayload = {
        ...changes,
      } as SubPlaceUpdatePayload;
      request$ = this.subPlacesService.updateSubPlace(
        this.selectedSubPlace!.id!,
        payload
      );
    } else {
      // Ensure parentId is always sent when creating
      const payload: SubPlaceCreatePayload = {
        parentId: this.subPlaceForm.value.parentId,
        ...changes,
      } as SubPlaceCreatePayload;
      request$ = this.subPlacesService
        .createSubPlace(payload)
        .pipe(switchMap(() => this.placesService.getPlaces()));
    }

    this.isSubPlaceButtonDisabled = true;

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.translateFn(
            isEdit
              ? 'PLACES.SUBPLACES.MESSAGES.UPDATE_SUCCESS'
              : 'PLACES.SUBPLACES.MESSAGES.CREATE_SUCCESS'
          )
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.translateFn(
            isEdit
              ? 'PLACES.SUBPLACES.MESSAGES.UPDATE_ERROR'
              : 'PLACES.SUBPLACES.MESSAGES.CREATE_ERROR'
          )
        );
        this.isSubPlaceButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  deleteSubPlace(subPlace: SubPlaceType): void {
    if (!subPlace.id) {
      return;
    }
    Swal.fire({
      title: this.translateFn('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.translateFn('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.translateFn('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.translateFn('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.subPlacesService
          .deleteSubPlace(subPlace.id)
          .subscribe({
            next: () => {
              this.alert.success(
                this.translateFn('PLACES.SUBPLACES.MESSAGES.DELETE_SUCCESS')
              );
            },
            error: () =>
              this.alert.error(
                this.translateFn('PLACES.SUBPLACES.MESSAGES.DELETE_ERROR')
              ),
          });
        this.subscriptions.add(sub);
      }
    });
  }

  loadSubPlaces(): void {
    this.subPlacesLoading = true;
    this.subPlacesError = null;
    const sub = this.subPlacesService.getAllSubPlaces().subscribe({
      next: () => {
        this.subPlacesLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.subPlacesError = this.translateFn('PLACES.SUBPLACES.ERROR.LOAD');
        this.subPlacesLoading = false;
        this.cd.detectChanges();
      },
    });
    this.subscriptions.add(sub);
  }

  pickSubPlaceAddress(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) {
      return;
    }
    const coords = event.latLng;
    this.subPlacePosition = { lat: coords.lat(), lng: coords.lng() };
    const control = this.subPlaceForm.get('location');
    control?.setValue({ coordinates: [coords.lng(), coords.lat()] });
    control?.markAsDirty();
    control?.markAsTouched();
  }

  isSubPlaceInvalid(controlName: string): boolean {
    const control = this.subPlaceForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private subscribeToSubPlaceFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.subPlaceForm.valueChanges.subscribe((values) => {
      this.isSubPlaceButtonDisabled = isEqual(this.initialValues, values);
    });
  }

  private buildSubPlaceForm(subPlace?: SubPlaceType): FormGroup {
    return this.fb.group({
      parentId: [subPlace?.parentId || ''],
      address: [subPlace?.address || ''],
      pickupInstructions: [subPlace?.pickupInstructions || ''],
      isDefault: [subPlace?.isDefault || false],
      location: [subPlace?.location || null],
    });
  }

  submit(modal?: any): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const initial = this.initialValues ?? this.form.value;
    const changes = {
      ...FormHelper.getChangedValues(
        omit(this.form.value, 'state', 'country'),
        omit(initial, 'state', 'country')
      ),
      ...(this.form.value.state?.id !== initial.state?.id
        ? { stateId: this.form.value.state?.id }
        : {}),
      ...(this.form.value.country?.id !== initial.country?.id
        ? { countryId: this.form.value.country?.id }
        : {}),
      kind: PlaceKindEnum.CITY,
    };

    const isEdit = !!this.selectedPlace?.id;
    const request$ = isEdit
      ? this.placesService.updatePlace(
          this.selectedPlace!.id!,
          changes as PlaceUpdatePayload
        )
      : this.placesService.createPlace(changes as PlaceCreatePayload);

    this.isButtonDisabled = true;

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.translateFn(
            isEdit
              ? 'PLACES.MESSAGES.UPDATE_SUCCESS'
              : 'PLACES.MESSAGES.CREATE_SUCCESS'
          )
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.translateFn(
            isEdit
              ? 'PLACES.MESSAGES.UPDATE_ERROR'
              : 'PLACES.MESSAGES.CREATE_ERROR'
          )
        );
        this.isButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  loadCountries(q?: string): void {
    this.countriesLoading = true;
    const sub = this.placesService.getCountries().subscribe({
      next: () => {
        this.countriesLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.countriesLoading = false;
        this.cd.detectChanges();
      },
    });
    this.subscriptions.add(sub);
  }

  onCountrySearch(term: { term: string }): void {
    this.countriesQuery = term.term || '';
    this.loadCountries(this.countriesQuery);
  }

  private resetStatesPagination(country: CountryType): void {
    this.statesCountry = country;
    this.states = [];
    this.statesLoading = false;
    this.placesService.resetStates();
  }

  getStatesByCountry() {
    if (!this.statesCountry) {
      return;
    }
    // set loading here to reflect the request status in the UI
    this.statesLoading = true;

    const sub = this.placesService
      .getStatesByCountry(this.statesCountry?.id)
      .subscribe({
        next: () => {
          this.statesLoading = false;
          this.cd.detectChanges();
        },
        error: (err) => {
          this.statesLoading = false;
          this.cd.detectChanges();
        },
      });
    this.subscriptions.add(sub);
  }

  loadMoreStates(): void {
    this.placesService.isLastStates$.pipe(take(1)).subscribe((isLast) => {
      if (!isLast) {
        this.statesLoading = true;
        this.placesService.statesPageIndex += 1;
        this.getStatesByCountry();
      }
    });
  }

  loadPlaces(): void {
    this.loading = true;
    this.error = null;
    const sub = this.placesService.getPlaces().subscribe({
      next: () => {
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.error = this.translateFn('PLACES.ERROR.LOAD');
        this.loading = false;
        this.cd.detectChanges();
      },
    });
    this.subscriptions.add(sub);
  }

  onCountryChange(): void {
    const country = this.form.get('country')?.value;
    this.form.get('state')?.setValue(undefined);
    this.resetStatesPagination(country || null);
    if (country) {
      this.getStatesByCountry();
    }
  }

  onPlacesSearchChange(): void {
    // update service search and push to debounced subject
    this.placesService.placesPageIndex = 0;
    this.placesService.placesSearchString = this.placesSearch;
    this.placesSearchInput$.next(this.placesSearch);
  }

  deletePlace(place: PlaceType): void {
    if (!place.id) {
      return;
    }
    Swal.fire({
      title: this.translateFn('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.translateFn('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.translateFn('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.translateFn('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.placesService.deletePlace(place.id).subscribe({
          next: () =>
            this.alert.success(
              this.translateFn('PLACES.MESSAGES.DELETE_SUCCESS')
            ),
          error: () =>
            this.alert.error(this.translateFn('PLACES.MESSAGES.DELETE_ERROR')),
        });
        this.subscriptions.add(sub);
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.form.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(this.initialValues, values);
    });
  }

  private buildForm(place?: PlaceType): FormGroup {
    return this.fb.group({
      city: [place?.city || ''],
      country: [place?.country || undefined],
      state: [place?.state || undefined],
    });
  }

  private translateFn(key: string): string {
    return this.translate.instant(key);
  }

  /**
   * Return a comma-separated list of sub-place addresses for use in titles/tooltips.
   */
  public getSubPlacesText(place: PlaceType): string {
    return (place?.subPlaces || []).map((sp) => sp.address || '-').join(', ');
  }
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
    this.placesService.resetPlaces();
    this.placesService.resetStates();
    this.subPlacesService.reset();
    this.states = [];
    this.placesService.parentPlacesPageIndex = 0;
    this.placesService.infinitePlaces$ = null;
  }
}
