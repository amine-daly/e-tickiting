import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { ThemeModeService } from 'src/app/_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
import { SplashScreenService } from 'src/app/_metronic/partials/layout/splash-screen/splash-screen.service';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  constructor(
    private modeService: ThemeModeService,
    private splashScreenService: SplashScreenService,
    private translationService: TranslationService,
    private router: Router,
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
        setTimeout(() => this.splashScreenService.hide(), 1500);
      });
  }
}
