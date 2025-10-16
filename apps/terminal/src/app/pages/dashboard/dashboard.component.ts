import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalConfig, ModalComponent } from '../../_metronic/partials';
import { TablesWidget5Component } from 'src/app/_metronic/partials/content/widgets/tables/tables-widget5/tables-widget5.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TablesWidget5Component],
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
