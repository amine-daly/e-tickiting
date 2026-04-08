import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbModal, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { isEqual, omit } from 'lodash';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  take,
  takeUntil,
} from 'rxjs';
import Swal from 'sweetalert2';

import { FormHelper } from '../../core/helpers/form-helper';
import { CountryType } from '../../core/models/country-type';
import { PlaceType } from '../../core/models/place-type';
import { StateType } from '../../core/models/state-type';
import { AlertService } from '../../core/services/alert.service';
import { IPagination } from 'src/app/core/models/paginate-model';
import {
  PlaceCreatePayload,
  PlacesService,
  PlaceUpdatePayload,
} from './places.service';

type PlaceFormValue = {
  city: string;
  country?: CountryType;
  state?: StateType;
};

@Component({
  selector: 'app-places',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    ReactiveFormsModule,
    FormsModule,
    NgbPaginationModule,
  ],
  templateUrl: './places.component.html',
  styleUrls: ['./places.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacesComponent implements OnInit, OnDestroy {
  private formChangesSub?: Subscription;
  private readonly subscriptions = new Subscription();
  private readonly destroy$ = new Subject<void>();
  private selectedPlace: PlaceType | null = null;
  private initialValues: PlaceFormValue | null = null;
  private statesCountry?: CountryType;

  statesLoading = false;
  countriesLoading = false;
  placesSearch = '';
  loading = true;
  form!: FormGroup;
  editing = false;
  isButtonDisabled = true;
  error: string | null = null;
  countries: CountryType[] = [];
  page = 1;
  pagination?: IPagination;

  readonly places$ = this.placesService.places$;
  readonly states$ = this.placesService.states$;
  readonly statesSearchInput$ = new Subject<string>();
  readonly countriesSearchInput$ = new Subject<string>();
  readonly placesSearchInput$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private cd: ChangeDetectorRef,
    private modalService: NgbModal,
    private translate: TranslateService,
    public placesService: PlacesService,
  ) {
    this.statesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchString) => {
          if (!this.statesCountry?.id) {
            this.placesService.resetStates();
            return of([]);
          }

          this.placesService.resetStates();
          this.placesService.statesSearchString = searchString;
          return this.placesService.getStatesByCountry(this.statesCountry.id);
        }),
      )
      .subscribe(() => {
        this.cd.markForCheck();
      });

    this.countriesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.countries = [];
          this.placesService.countriesSearchString = searchString;
          return this.placesService.getCountries();
        }),
      )
      .subscribe(() => {
        this.cd.markForCheck();
      });

    this.placesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.loading = true;
          this.page = 1;
          this.placesService.placesPageIndex = 0;
          this.placesService.placesSearchString = searchString;
          return this.placesService.getPlaces();
        }),
      )
      .subscribe(() => {
        this.loading = false;
        this.cd.markForCheck();
      });

    this.placesService.countries$
      .pipe(takeUntil(this.destroy$))
      .subscribe((countries) => {
        this.countries = countries;
        this.cd.markForCheck();
      });
  }

  ngOnInit(): void {
    this.loadPlaces();

    this.placesService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pagination) => {
        if (!pagination) {
          return;
        }

        this.pagination = {
          length: pagination.length,
          page: this.placesService.placesPageIndex || 0,
          size: this.placesService.placesPageLimit,
          lastPage: pagination.length - 1,
          startIndex:
            (this.placesService.placesPageIndex || 0) *
            this.placesService.placesPageLimit,
          endIndex: Math.min(
            ((this.placesService.placesPageIndex || 0) + 1) *
              this.placesService.placesPageLimit -
              1,
            pagination.length - 1,
          ),
        };
        this.page = this.placesService.placesPageIndex + 1;
        this.cd.markForCheck();
      });
  }

  onPageChange(page: number): void {
    if (page === this.page) {
      return;
    }

    this.page = page;
    this.placesService.placesPageIndex = page - 1;
    this.loadPlaces();
  }

  openPlaceModal(placeModal: TemplateRef<any>, place?: PlaceType): void {
    this.selectedPlace = place ?? null;
    this.editing = !!place;
    this.form = this.buildForm(place);
    this.loadCountries('');

    const initialCountry = this.form.get('country')?.value as
      | CountryType
      | undefined;
    this.resetStates(initialCountry);
    if (initialCountry) {
      this.getStatesByCountry();
    }

    this.initialValues = this.form.getRawValue() as PlaceFormValue;
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
    this.modalService.open(placeModal, { size: 'lg' });
    this.cd.markForCheck();
  }

  submit(modal?: { close: () => void }): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue() as PlaceFormValue;
    const initial = this.initialValues ?? rawValue;
    const changes = {
      ...FormHelper.getChangedValues(
        omit(rawValue, 'state', 'country'),
        omit(initial, 'state', 'country'),
      ),
      ...(rawValue.state?.id !== initial.state?.id
        ? { stateId: rawValue.state?.id }
        : {}),
      ...(rawValue.country?.id !== initial.country?.id
        ? { countryId: rawValue.country?.id }
        : {}),
    };

    const request$ = this.selectedPlace?.id
      ? this.placesService.updatePlace(
          this.selectedPlace.id,
          changes as PlaceUpdatePayload,
        )
      : this.placesService.createPlace(changes as PlaceCreatePayload);

    this.isButtonDisabled = true;

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.translateFn(
            this.selectedPlace?.id
              ? 'PLACES.MESSAGES.UPDATE_SUCCESS'
              : 'PLACES.MESSAGES.CREATE_SUCCESS',
          ),
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.translateFn(
            this.selectedPlace?.id
              ? 'PLACES.MESSAGES.UPDATE_ERROR'
              : 'PLACES.MESSAGES.CREATE_ERROR',
          ),
        );
        this.isButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  loadCountries(searchString = this.placesService.countriesSearchString): void {
    this.countriesLoading = true;
    this.placesService.countriesSearchString = searchString;

    const sub = this.placesService.getCountries().subscribe({
      next: () => {
        this.countriesLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.countriesLoading = false;
        this.cd.markForCheck();
      },
    });
    this.subscriptions.add(sub);
  }

  onCountrySearch(term: { term: string }): void {
    this.countriesSearchInput$.next(term.term || '');
  }

  onStateSearch(term: { term: string }): void {
    this.statesSearchInput$.next(term.term || '');
  }

  private resetStates(country?: CountryType): void {
    this.statesCountry = country;
    this.statesLoading = false;
    this.placesService.resetStates();
  }

  getStatesByCountry(): void {
    if (!this.statesCountry?.id) {
      return;
    }

    this.statesLoading = true;
    const sub = this.placesService
      .getStatesByCountry(this.statesCountry.id)
      .subscribe({
        next: () => {
          this.statesLoading = false;
          this.cd.markForCheck();
        },
        error: () => {
          this.statesLoading = false;
          this.cd.markForCheck();
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
        this.cd.markForCheck();
      },
      error: () => {
        this.error = this.translateFn('PLACES.ERROR.LOAD');
        this.loading = false;
        this.cd.markForCheck();
      },
    });
    this.subscriptions.add(sub);
  }

  onCountryChange(): void {
    const country = this.form.get('country')?.value as CountryType | undefined;
    this.form.get('state')?.setValue(undefined);
    this.resetStates(country);

    if (country) {
      this.getStatesByCountry();
    }
  }

  onPlacesSearchChange(): void {
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
          next: () => {
            this.alert.success(
              this.translateFn('PLACES.MESSAGES.DELETE_SUCCESS'),
            );
          },
          error: () => {
            this.alert.error(this.translateFn('PLACES.MESSAGES.DELETE_ERROR'));
          },
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
      city: [place?.city || '', Validators.required],
      country: [place?.country || undefined],
      state: [place?.state || undefined],
    });
  }

  private translateFn(key: string): string {
    return this.translate.instant(key);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
    this.placesService.resetPlaces();
    this.placesService.resetStates();
    this.countries = [];
  }
}
