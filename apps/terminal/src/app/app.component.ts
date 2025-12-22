import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

import { ThemeModeService } from './_metronic/partials/layout/theme-mode-switcher/theme-mode.service';
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
    // Ensure service is instantiated so language is set and translation files are loaded.
    private translationService: TranslationService
  ) {}

  ngOnInit() {
    this.modeService.init();
  }
}
