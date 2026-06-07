import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { filter, take } from 'rxjs/operators';

import { ThemeModeService } from './_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
import { SplashScreenService } from './_metronic/partials/layout/splash-screen/splash-screen.service';
import { TranslationService } from './modules/i18n/translation.service';

@Component({
  // tslint:disable-next-line:component-selector
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body[root]',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  constructor(
    private modeService: ThemeModeService,
    private splashScreenService: SplashScreenService,
    // Ensure service is instantiated so language is set and translation files are loaded.
    private translationService: TranslationService,
    private router: Router,
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
  }
}
