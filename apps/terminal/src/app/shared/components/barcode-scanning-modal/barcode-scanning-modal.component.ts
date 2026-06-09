import {
  Input,
  NgZone,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  Barcode,
  BarcodeFormat,
  BarcodeScanner,
  LensFacing,
  StartScanOptions,
} from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { close, flashlight } from 'ionicons/icons';
import { DialogService } from '../../services/dialog.service';

addIcons({ close, flashlight });

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFab,
    IonFabButton,
  ],
  selector: 'app-barcode-scanning-modal',
  templateUrl: './barcode-scanning-modal.component.html',
  styleUrls: ['./barcode-scanning-modal.component.scss'],
})
export class BarcodeScanningModalComponent implements AfterViewInit, OnDestroy {
  @Input() formats: BarcodeFormat[] = [BarcodeFormat.QrCode];
  @Input() lensFacing: LensFacing = LensFacing.Back;
  @Input() title = 'Scan Ticket QR';

  @ViewChild('square') squareElement!: ElementRef<HTMLDivElement>;
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;

  isTorchAvailable = false;
  torchEnabled = false;

  private listener: { remove: () => Promise<void> } | undefined;

  constructor(
    private readonly dialogService: DialogService,
    private readonly ngZone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    // Delay lets the modal layout settle so the detection square rect is accurate.
    setTimeout(() => {
      void this.startScan().then(() => {
        void BarcodeScanner.isTorchAvailable().then((result) => {
          this.isTorchAvailable = result.available;
        });
      });
    }, 500);
  }

  ngOnDestroy(): void {
    void this.stopScan();
  }

  async closeModal(barcode?: Barcode): Promise<void> {
    await this.stopScan();
    await this.dialogService.dismissModal({ barcode });
  }

  async toggleTorch(): Promise<void> {
    await BarcodeScanner.toggleTorch();
    const { enabled } = await BarcodeScanner.isTorchEnabled();
    this.torchEnabled = enabled;
  }

  private async startScan(): Promise<void> {
    document.documentElement.classList.add('barcode-scanning-active');
    document.body.classList.add('barcode-scanning-active');

    const options: StartScanOptions = {
      formats: this.formats,
      lensFacing: this.lensFacing,
      videoElement:
        Capacitor.getPlatform() === 'web'
          ? this.videoElement?.nativeElement
          : undefined,
    };

    const rect = this.squareElement?.nativeElement.getBoundingClientRect();
    const scaledRect = rect
      ? {
          left: rect.left * window.devicePixelRatio,
          right: rect.right * window.devicePixelRatio,
          top: rect.top * window.devicePixelRatio,
          bottom: rect.bottom * window.devicePixelRatio,
          width: rect.width * window.devicePixelRatio,
          height: rect.height * window.devicePixelRatio,
        }
      : undefined;

    const detectionCornerPoints = scaledRect
      ? [
          [scaledRect.left, scaledRect.top],
          [scaledRect.left + scaledRect.width, scaledRect.top],
          [scaledRect.left + scaledRect.width, scaledRect.top + scaledRect.height],
          [scaledRect.left, scaledRect.top + scaledRect.height],
        ]
      : undefined;

    this.listener = await BarcodeScanner.addListener(
      'barcodesScanned',
      async (event) => {
        this.ngZone.run(() => {
          const firstBarcode = event.barcodes[0];
          if (!firstBarcode) return;

          const cornerPoints = firstBarcode.cornerPoints;
          if (
            detectionCornerPoints &&
            cornerPoints &&
            Capacitor.getPlatform() !== 'web'
          ) {
            if (
              detectionCornerPoints[0][0] > cornerPoints[0][0] ||
              detectionCornerPoints[0][1] > cornerPoints[0][1] ||
              detectionCornerPoints[1][0] < cornerPoints[1][0] ||
              detectionCornerPoints[1][1] > cornerPoints[1][1] ||
              detectionCornerPoints[2][0] < cornerPoints[2][0] ||
              detectionCornerPoints[2][1] < cornerPoints[2][1] ||
              detectionCornerPoints[3][0] > cornerPoints[3][0] ||
              detectionCornerPoints[3][1] < cornerPoints[3][1]
            ) {
              return;
            }
          }

          void this.listener?.remove();
          void this.closeModal(firstBarcode);
        });
      },
    );

    await BarcodeScanner.startScan(options);
  }

  private async stopScan(): Promise<void> {
    document.documentElement.classList.remove('barcode-scanning-active');
    document.body.classList.remove('barcode-scanning-active');
    await this.listener?.remove();
    this.listener = undefined;
    await BarcodeScanner.stopScan();
  }
}
