import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { ThemeModeService } from 'src/app/_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { MobileFooterComponent } from './components/mobile-footer/mobile-footer.component';
import { ScanQrCodeComponent } from './components/scan-qr-code/scan-qr-code.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    IonApp,
    IonRouterOutlet,
    MobileFooterComponent,
    ScanQrCodeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  showFooter = false;
  showScanner = false;

  private readonly GUEST_PATHS = ['/auth', '/error'];

  constructor(
    private modeService: ThemeModeService,
    private translationService: TranslationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.modeService.init();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.showFooter = !this.GUEST_PATHS.some((p) =>
          e.urlAfterRedirects.startsWith(p),
        );
        this.cdr.markForCheck();
      });
  }

  openScanner(): void {
    this.showScanner = true;
    this.cdr.markForCheck();
  }

  onScannerClosed(): void {
    this.showScanner = false;
    this.cdr.markForCheck();
  }

  onScanned(value: string): void {
    this.showScanner = false;
    this.cdr.markForCheck();
    this.router.navigate(['/tickets'], { queryParams: { scan: value } });
  }
}
