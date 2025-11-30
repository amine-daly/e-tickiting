import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ModalConfig, ModalComponent } from '../../_metronic/partials';
import { ChartsWidget1Component } from '../../_metronic/partials/content/widgets/charts/charts-widget1/charts-widget1.component';
import { ChartsWidget2Component } from '../../_metronic/partials/content/widgets/charts/charts-widget2/charts-widget2.component';
import { ChartsWidget3Component } from '../../_metronic/partials/content/widgets/charts/charts-widget3/charts-widget3.component';
import { ChartsWidget4Component } from '../../_metronic/partials/content/widgets/charts/charts-widget4/charts-widget4.component';
import { ChartsWidget5Component } from '../../_metronic/partials/content/widgets/charts/charts-widget5/charts-widget5.component';
import { ChartsWidget6Component } from '../../_metronic/partials/content/widgets/charts/charts-widget6/charts-widget6.component';
import { ChartsWidget7Component } from '../../_metronic/partials/content/widgets/charts/charts-widget7/charts-widget7.component';
import { ChartsWidget8Component } from '../../_metronic/partials/content/widgets/charts/charts-widget8/charts-widget8.component';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ChartsWidget1Component,
    ChartsWidget2Component,
    ChartsWidget3Component,
    ChartsWidget4Component,
    ChartsWidget5Component,
    ChartsWidget6Component,
    ChartsWidget7Component,
    ChartsWidget8Component,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  modalConfig: ModalConfig = {
    modalTitle: 'Modal title',
    dismissButtonLabel: 'Submit',
    closeButtonLabel: 'Cancel',
  };
  @ViewChild('modal') private modalComponent: ModalComponent;
  constructor() {}

  async openModal() {
    return await this.modalComponent.open();
  }
}
