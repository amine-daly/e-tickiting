import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SearchResultInnerComponent } from '../../../../partials/layout/extras/dropdown-inner/search-result-inner/search-result-inner.component';
import { NotificationsInnerComponent } from '../../../../partials/layout/extras/dropdown-inner/notifications-inner/notifications-inner.component';
import { QuickLinksInnerComponent } from '../../../../partials/layout/extras/dropdown-inner/quick-links-inner/quick-links-inner.component';
import { ThemeModeSwitcherComponent } from '../../../../partials/layout/theme-mode-switcher/theme-mode-switcher.component';
import { UserInnerComponent } from '../../../../partials/layout/extras/dropdown-inner/user-inner/user-inner.component';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { AuthService } from 'src/app/modules/auth';
import {
  PointOfSaleType,
  AccountType,
} from 'src/app/core/models/account.model';
import { UserType } from 'src/app/core/models/user-type';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NgbDropdownModule,
    KeeniconComponent,
    SearchResultInnerComponent,
    NotificationsInnerComponent,
    QuickLinksInnerComponent,
    ThemeModeSwitcherComponent,
    UserInnerComponent,
  ],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() appHeaderDefaulMenuDisplay: boolean;
  @Input() isRtl: boolean;

  itemClass: string = 'ms-1 ms-lg-3';
  btnClass: string =
    'btn btn-icon btn-custom btn-icon-muted btn-active-light btn-active-color-primary w-35px h-35px w-md-40px h-md-40px';
  userAvatarClass: string = 'symbol-35px symbol-md-40px';
  btnIconClass: string = 'fs-2 fs-md-1';

  // POS selector
  currentPos: PointOfSaleType | null = null;
  accounts: AccountType[] = [];
  currentUser: UserType | null = null;
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Subscribe to current POS
    this.authService.pos$.pipe(takeUntil(this.destroy$)).subscribe((pos) => {
      this.currentPos = pos;
    });

    // Subscribe to accounts list
    this.authService.accounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts) => {
        this.accounts = accounts || [];
        console.log(
          '🚀 ~ NavbarComponent ~ ngOnInit ~ this.accounts:',
          this.accounts,
        );
      });

    // Subscribe to current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
      });
  }

  selectPos(account: AccountType): void {
    const pos = account.target?.pos;
    if (pos?.id) {
      localStorage.setItem('posId', pos.id);
      this.authService.pos$ = pos;
      window.location.reload();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
