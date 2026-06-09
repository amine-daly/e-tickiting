import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { filter, take } from 'rxjs/operators';

import { ThemeModeService } from './_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
import { SplashScreenService } from './_metronic/partials/layout/splash-screen/splash-screen.service';
import { TranslationService } from './modules/i18n/translation.service';
import { ScanQrCodeComponent } from './components/scan-qr-code/scan-qr-code.component';
import { MobileShellService } from './core/services/mobile-shell.service';

@Component({
  // tslint:disable-next-line:component-selector
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body[root]',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ScanQrCodeComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  showScanner = false;

  constructor(
    private modeService: ThemeModeService,
    private splashScreenService: SplashScreenService,
    // Ensure service is instantiated so language is set and translation files are loaded.
    private translationService: TranslationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private mobileShell: MobileShellService,
  ) {}

  ngOnInit() {
    this.modeService.init();
    this.splashScreenService.initFromDocument();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        take(1),
      )
      .subscribe(() => {
        setTimeout(() => this.splashScreenService.hide(), 150);
      });

    this.mobileShell.scanRequested$.subscribe(() => {
      this.openScanner();
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

  onScanned(_value: string): void {
    // Do NOT close the scanner here — that aborts the boarding HTTP request.
  }
}
