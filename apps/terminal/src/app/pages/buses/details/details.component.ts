import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject, from } from 'rxjs';
import { map, finalize, takeUntil } from 'rxjs/operators';
import { isEqual } from 'lodash';

import { BusService } from '../bus.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { AmenityEnum, BusType } from 'src/app/core/models/bus.model';
import { Picture } from 'src/app/core/models/shared.model';
import { AmazonS3Helper } from '../../../../../../../libs/helpers/amazon-s3-helper';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectModule,
    ToolbarComponent,
  ],
  providers: [AmazonS3Helper],
  selector: 'app-bus-details',
  templateUrl: './details.component.html',
})
export class BusDetailsComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private destroy$ = new Subject<void>();

  busForm: FormGroup;
  isSubmitting = false;
  isButtonDisabled = true;
  isUploading = false;
  uploadPreviewUrl: string | null = null;
  seatsLocked = false;

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
    private route: ActivatedRoute,
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

      this.initialValues = this.busForm.getRawValue();

      this.busForm.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((values) => {
          const current = this.busForm.getRawValue();
          this.isButtonDisabled = isEqual(current, this.initialValues);
        });

      if (this.bus) {
        this.pageInfo.setTitle(this.translate.instant('BUSES.FORM.EDIT_TITLE'));
        // Check if totalSeats is locked (bus assigned to SCHEDULED/ACTIVE trip)
        this.busService
          .isBusLocked(this.bus.id!)
          .pipe(takeUntil(this.destroy$))
          .subscribe((locked) => {
            this.seatsLocked = locked;
            if (locked) {
              this.busForm.get('totalSeats')?.disable();
            }
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
      const posId = localStorage.getItem('posId');
      const { objectKey, request$ } = this.amazonS3Helper.uploadS3Aws(
        file,
        posId,
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

    if (Object.keys(changes).length === 0) {
      return;
    }

    this.isSubmitting = true;
    const posId = localStorage.getItem('posId') || '';

    const request$ = this.bus
      ? this.busService.update(this.bus.id!, changes)
      : this.busService.create({ ...changes, target: { pos: posId } });

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const msg = this.bus
          ? this.translate.instant('BUSES.MESSAGES.UPDATE_SUCCESS')
          : this.translate.instant('BUSES.MESSAGES.CREATE_SUCCESS');
        this.alert.success(msg);
        if (!this.bus) {
          this.router.navigate(['/buses']);
        }
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
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
