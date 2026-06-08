import { Injectable } from '@angular/core';
import { ModalController, ModalOptions } from '@ionic/angular/standalone';

@Injectable({ providedIn: 'root' })
export class DialogService {
  private modal: HTMLIonModalElement | undefined;

  constructor(private readonly modalController: ModalController) {}

  async showModal(options: ModalOptions): Promise<HTMLIonModalElement> {
    this.modal = await this.modalController.create(options);
    await this.modal.present();
    return this.modal;
  }

  async dismissModal(data?: unknown): Promise<void> {
    if (this.modal) {
      await this.modal.dismiss(data);
      this.modal = undefined;
    }
  }
}
