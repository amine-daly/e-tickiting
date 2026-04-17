import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormGroup,
  Validators,
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { isEqual } from 'lodash';
import { Subject, from } from 'rxjs';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { Router, RouterModule } from '@angular/router';
import { map, finalize, takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BusService } from '../bus.service';
import { Picture } from 'src/app/core/models/shared.model';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { AlertService } from 'src/app/core/services/alert.service';
import {
  AmenityEnum,
  BusType,
  LayoutElementType,
  LayoutTemplate,
} from 'src/app/core/models/bus.model';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { AmazonS3Helper } from '../../../../../../../libs/helpers/amazon-s3-helper';

type SeatEntryMode = 'MANUAL' | 'VISUAL';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    ToolbarComponent,
  ],
  providers: [AmazonS3Helper],
  selector: 'app-bus-details',
  templateUrl: './details.component.html',
})
export class BusDetailsComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private destroy$ = new Subject<void>();
  private manualTotalSeatsDraft: number | null = null;
  private pendingLayoutDeletion = false;

  busForm: FormGroup;
  isSubmitting = false;
  isButtonDisabled = true;
  isUploading = false;
  uploadPreviewUrl: string | null = null;
  seatsLocked = false;
  seatEntryMode: SeatEntryMode = 'MANUAL';

  /** All amenity options for ng-select */
  amenityOptions = Object.values(AmenityEnum).map((value) => ({
    value,
    label: value,
  }));

  /** Maps AmenityEnum → duotone icon class */
  readonly amenityIcons: Record<string, string> = {
    [AmenityEnum.WIFI]: 'ki-duotone ki-wifi',
    [AmenityEnum.POWER_OUTLET]: 'ki-duotone ki-electricity',
    [AmenityEnum.TV]: 'ki-duotone ki-screen',
    [AmenityEnum.SNACKS]: 'ki-duotone ki-coffee',
    [AmenityEnum.AC]: 'ki-duotone ki-cloud',
    [AmenityEnum.TOILET]: 'ki-duotone ki-drop',
    [AmenityEnum.LUGGAGE]: 'ki-duotone ki-briefcase',
    [AmenityEnum.USB]: 'ki-duotone ki-usb',
  };

  bus: BusType;

  get pictures(): Picture[] {
    return this.picturesArray.getRawValue();
  }

  private get picturesArray(): FormArray {
    return this.busForm.get(['media', 'pictures']) as FormArray;
  }

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private alert: AlertService,
    private amazonS3Helper: AmazonS3Helper,
    private busService: BusService,
    private pageInfo: PageInfoService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Read resolved bus (only present on edit route)
    this.busService.bus$.pipe(takeUntil(this.destroy$)).subscribe((bus) => {
      this.bus = bus;
      this.seatEntryMode = this.bus?.layoutTemplate ? 'VISUAL' : 'MANUAL';
      this.manualTotalSeatsDraft = this.normalizeTotalSeats(this.bus?.totalSeats);
      this.pendingLayoutDeletion = false;

      this.busForm = this.fb.group({
        name: [this.bus?.name || '', [Validators.required]],
        totalSeats: [
          this.bus?.totalSeats || null,
          [Validators.required, Validators.min(1)],
        ],
        amenities: [this.bus?.amenities || []],
        media: this.fb.group({
          pictures: this.fb.array(
            (this.bus?.media?.pictures || []).map((pic) =>
              this.fb.group({
                baseUrl: [pic.baseUrl || ''],
                path: [pic.path || ''],
              }),
            ),
          ),
        }),
      });

      this.applySeatEntryModeState();
      this.initialValues = this.busForm.getRawValue();
      this.syncButtonState();

      this.busForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.syncButtonState();
        });

      this.busForm
        .get('totalSeats')
        ?.valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          if (this.seatEntryMode === 'MANUAL') {
            this.manualTotalSeatsDraft = this.normalizeTotalSeats(value);
          }
        });

      if (this.bus) {
        this.pageInfo.setTitle(this.translate.instant('BUSES.FORM.EDIT_TITLE'));
        // Check if totalSeats is locked (bus assigned to SCHEDULED/ACTIVE trip)
        this.busService
          .isBusLocked(this.bus.id!)
          .pipe(takeUntil(this.destroy$))
          .subscribe((locked) => {
            this.seatsLocked = locked;
            this.applySeatEntryModeState();
          });
      } else {
        this.pageInfo.setTitle(this.translate.instant('BUSES.FORM.ADD_TITLE'));
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.busForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get isVisualMode(): boolean {
    return this.seatEntryMode === 'VISUAL';
  }

  get canToggleSeatEntryMode(): boolean {
    return !!this.bus && !this.seatsLocked;
  }

  get hasPersistedLayout(): boolean {
    return !!this.bus?.layoutTemplate;
  }

  async onSeatEntryModeToggle(checked: boolean): Promise<void> {
    const nextMode: SeatEntryMode = checked ? 'VISUAL' : 'MANUAL';

    if (nextMode === this.seatEntryMode) {
      return;
    }

    if (nextMode === 'VISUAL' && !this.canToggleSeatEntryMode) {
      this.cdr.markForCheck();
      return;
    }

    if (nextMode === 'MANUAL' && this.hasPersistedLayout) {
      const result = await this.alert.fire({
        icon: 'warning',
        title: this.translate.instant('BUSES.LAYOUT.SWITCH_TO_MANUAL_TITLE'),
        text: this.translate.instant('BUSES.LAYOUT.SWITCH_TO_MANUAL_TEXT'),
        showCancelButton: true,
        confirmButtonText: this.translate.instant(
          'BUSES.LAYOUT.SWITCH_TO_MANUAL_CONFIRM',
        ),
        cancelButtonText: this.translate.instant('COMMON.BUTTON.CANCEL'),
        confirmButtonColor: 'rgb(3, 142, 220)',
        cancelButtonColor: 'rgb(243, 78, 78)',
      });

      if (!result.isConfirmed) {
        this.cdr.markForCheck();
        return;
      }

      this.pendingLayoutDeletion = true;
    } else if (nextMode === 'VISUAL') {
      this.pendingLayoutDeletion = false;
    }

    this.manualTotalSeatsDraft = this.normalizeTotalSeats(
      this.busForm.get('totalSeats')?.getRawValue(),
    );
    this.seatEntryMode = nextMode;
    this.applySeatEntryModeState();
    this.cdr.markForCheck();
  }

  goToLayoutBuilder(): void {
    if (!this.bus || !this.isVisualMode) {
      return;
    }

    this.router.navigate(['/buses', this.bus.id, 'layout']);
  }

  private applySeatEntryModeState(): void {
    const totalSeatsControl = this.busForm?.get('totalSeats');
    if (!totalSeatsControl) {
      return;
    }

    if (this.isVisualMode) {
      const visualSeats = this.hasPersistedLayout
        ? this.countLayoutSeats(this.bus?.layoutTemplate)
        : this.manualTotalSeatsDraft;
      totalSeatsControl.setValue(visualSeats, { emitEvent: false });
      totalSeatsControl.disable({ emitEvent: false });
    } else {
      totalSeatsControl.setValue(this.manualTotalSeatsDraft, {
        emitEvent: false,
      });

      if (this.seatsLocked) {
        totalSeatsControl.disable({ emitEvent: false });
      } else {
        totalSeatsControl.enable({ emitEvent: false });
      }
    }

    this.syncButtonState();
  }

  private syncButtonState(): void {
    if (!this.busForm) {
      return;
    }

    const current = this.busForm.getRawValue();
    this.isButtonDisabled =
      isEqual(current, this.initialValues) && !this.pendingLayoutDeletion;
  }

  private countLayoutSeats(layoutTemplate?: LayoutTemplate | null): number {
    if (!layoutTemplate) {
      return 0;
    }

    return [layoutTemplate.lowerDeck, layoutTemplate.upperDeck]
      .flat()
      .filter((element) => element?.type === LayoutElementType.SEAT).length;
  }

  private normalizeTotalSeats(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  /* ═══════ Picture management ═══════ */

  getPictureUrl(pic: Picture): string {
    const baseUrl = (pic?.baseUrl || '').replace(/\/+$/, '');
    const path = pic?.path || '';
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  uploadPicture(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      this.uploadPreviewUrl = URL.createObjectURL(file);
      this.isUploading = true;
      this.cdr.markForCheck();
      const companyId = localStorage.getItem('companyId');
      const { objectKey, request$ } = this.amazonS3Helper.uploadS3Aws(
        file,
        companyId,
      );

      from(request$)
        .pipe(
          map((uploadRes) => ({
            path: uploadRes.path || objectKey,
            baseUrl: uploadRes.baseUrl || '',
          })),
          finalize(() => {
            this.isUploading = false;
            if (this.uploadPreviewUrl) {
              URL.revokeObjectURL(this.uploadPreviewUrl);
              this.uploadPreviewUrl = null;
            }
          }),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: (picture) => {
            const pictureGroup = this.fb.group({
              baseUrl: [''],
              path: [''],
            });
            this.picturesArray.push(pictureGroup);
            pictureGroup.patchValue({
              baseUrl: picture.baseUrl || '',
              path: picture.path || '',
            });
            if (this.bus) {
              this.persistMediaChanges();
            } else {
              this.markFormDirty();
            }
            this.cdr.markForCheck();
          },
          error: () => {
            this.alert.error(
              this.translate.instant('BUSES.MESSAGES.UPLOAD_ERROR'),
            );
            this.isUploading = false;
            this.cdr.markForCheck();
          },
        });
    };

    fileInput.click();
  }

  removePicture(index: number): void {
    const pic = this.pictures[index];
    if (pic?.path) {
      this.amazonS3Helper.deleteFileFromAws(pic.path);
    }
    this.picturesArray.removeAt(index);
    if (this.bus) {
      this.persistMediaChanges();
    } else {
      this.markFormDirty();
    }
  }

  private markFormDirty(): void {
    this.busForm.markAsDirty();
    const current = this.busForm.getRawValue();
    this.isButtonDisabled = isEqual(current, this.initialValues);
  }

  private persistMediaChanges(): void {
    if (!this.bus) return;
    const payload = {
      media: {
        pictures: this.pictures,
      },
    };
    this.busService
      .update(this.bus.id!, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant('BUSES.MESSAGES.UPDATE_SUCCESS'),
          );
        },
        error: () => {
          this.alert.error(
            this.translate.instant('BUSES.MESSAGES.UPDATE_ERROR'),
          );
        },
      });
  }

  /* ═══════ Submit ═══════ */

  submit(): void {
    if (this.busForm.invalid) {
      this.busForm.markAllAsTouched();
      return;
    }

    const raw = this.busForm.getRawValue();
    const changes = FormHelper.getChangedValues(raw, this.initialValues);

    if (this.isVisualMode) {
      delete changes.totalSeats;
    }

    if (this.pendingLayoutDeletion) {
      changes.clearLayout = true;
      changes.totalSeats = raw.totalSeats;
    }

    if (Object.keys(changes).length === 0) {
      return;
    }

    this.isSubmitting = true;
    const companyId = localStorage.getItem('companyId') || '';

    const request$ = this.bus
      ? this.busService.update(this.bus.id!, changes)
      : this.busService.create({ ...changes, target: { company: companyId } });

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (savedBus) => {
        const msg = this.bus
          ? this.translate.instant('BUSES.MESSAGES.UPDATE_SUCCESS')
          : this.translate.instant('BUSES.MESSAGES.CREATE_SUCCESS');

        if (this.bus) {
          this.bus = savedBus;
          this.pendingLayoutDeletion = false;
          this.seatEntryMode = savedBus.layoutTemplate ? 'VISUAL' : 'MANUAL';
          this.manualTotalSeatsDraft = this.normalizeTotalSeats(
            savedBus.totalSeats,
          );
          this.applySeatEntryModeState();
          this.initialValues = this.busForm.getRawValue();
          this.syncButtonState();
        }

        this.isSubmitting = false;
        this.alert.success(msg);
        if (!this.bus) {
          this.router.navigate(['/buses']);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        const backendMsg: string = err?.error?.message || '';
        let message: string;
        if (backendMsg.includes('BUS_SEATS_LOCKED_ACTIVE_TRIP')) {
          message = this.translate.instant('BUSES.MESSAGES.SEATS_LOCKED');
        } else {
          message = this.bus
            ? this.translate.instant('BUSES.MESSAGES.UPDATE_ERROR')
            : this.translate.instant('BUSES.MESSAGES.CREATE_ERROR');
        }
        this.alert.error(message);
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.busService.bus$ = null;
  }
}
