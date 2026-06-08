import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { ThemeModeService } from 'src/app/_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
import { SplashScreenService } from 'src/app/_metronic/partials/layout/splash-screen/splash-screen.service';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { ScanQrCodeComponent } from './components/scan-qr-code/scan-qr-code.component';
import { MobileShellService } from 'src/app/core/services/mobile-shell.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    IonApp,
    IonRouterOutlet,
    ScanQrCodeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  showScanner = false;

  constructor(
    private modeService: ThemeModeService,
    private splashScreenService: SplashScreenService,
    private translationService: TranslationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private mobileShell: MobileShellService,
  ) {}

  ngOnInit(): void {
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
    // Do NOT close the scanner or navigate here — that destroys the component
    // and aborts the in-flight boarding HTTP request (NS_BINDING_ABORTED).
    // The scanner overlay manages its own success/rejection/idle states.
  }
}
