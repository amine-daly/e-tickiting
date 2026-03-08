import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EMPTY, from, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { CustomersService } from '../customers.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserType } from 'src/app/core/models/user-type';
import { AmazonS3Helper } from '../../../../../../../libs/helpers/amazon-s3-helper';
import { AlertService } from 'src/app/core/services/alert.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, RouterModule, KeeniconComponent, TranslateModule],
  providers: [AmazonS3Helper],
  templateUrl: './account.component.html',
})
export class AccountComponent {
  user$ = this.customersService.user$;
  defaultAvatar = 'assets/placeholders/avatar-1.svg';

  constructor(
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    private amazonS3Helper: AmazonS3Helper,
    private customersService: CustomersService,
  ) {}

  upload(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.name = 'fileUpload';
    fileInput.id = 'fileUpload';

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }

      this.user$
        .pipe(
          take(1),
          switchMap((user) => {
            if (!user?.id) {
              return EMPTY;
            }

            const oldPicturePath: string | undefined = user?.picture?.path;
            const posId = localStorage.getItem('posId');
            const { objectKey, request$ } = this.amazonS3Helper.uploadS3Aws(
              file,
              posId,
            );

            return from(request$).pipe(
              map((uploadRes) => ({
                userId: user.id,
                oldPicturePath,
                picture: {
                  path: uploadRes.path || objectKey,
                  baseUrl: uploadRes.baseUrl,
                },
              })),
            );
          }),
          switchMap(({ userId, oldPicturePath, picture }) =>
            this.customersService.updateCustomer(userId, { picture }).pipe(
              switchMap((updatedUser) => {
                if (!oldPicturePath || oldPicturePath === picture.path) {
                  return of(updatedUser);
                }
                const deleteRequest$ =
                  this.amazonS3Helper.deleteFileFromAws(oldPicturePath);
                if (!deleteRequest$) {
                  return of(updatedUser);
                }
                return from(deleteRequest$).pipe(
                  map(() => updatedUser),
                  catchError(() => of(updatedUser)),
                );
              }),
            ),
          ),
        )
        .subscribe({
          next: () => {
            this.alert.success('Succès', 'Profil mis à jour.');
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.alert.error(
              'Échec',
              err?.error?.message || 'Une erreur est survenue.',
            );
            this.cdr.markForCheck();
          },
        });
    };

    fileInput.click();
  }

  getProfileImageUrl(user: UserType): string {
    const baseUrl = user?.picture?.baseUrl;
    const path = user?.picture?.path;
    if (!baseUrl || !path) {
      return this.defaultAvatar;
    }
    return `${baseUrl}/${path}`;
  }
}
