import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

declare const BarcodeDetector: any;

@Component({
  selector: 'app-scan-qr-code',
  standalone: true,
  imports: [CommonModule, KeeniconComponent],
  templateUrl: './scan-qr-code.component.html',
  styleUrls: ['./scan-qr-code.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanQrCodeComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl', { static: false }) videoRef!: ElementRef<HTMLVideoElement>;
  @Output() scanned = new EventEmitter<string>();
  @Output() closed  = new EventEmitter<void>();

  scanning = false;
  error: string | null = null;
  supported = false;

  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private detector: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.supported = typeof BarcodeDetector !== 'undefined';
    if (!this.supported) {
      this.error = 'QR scanning is not supported in this browser.';
    }
    this.cdr.markForCheck();
  }

  async start(): Promise<void> {
    if (!this.supported) return;

    this.error = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();

      this.detector = new BarcodeDetector({ formats: ['qr_code'] });
      this.scanning = true;
      this.cdr.markForCheck();
      this.detect();
    } catch (err: any) {
      this.error = err?.message ?? 'Camera access denied.';
      this.scanning = false;
      this.cdr.markForCheck();
    }
  }

  private detect(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || !this.scanning) return;

    this.rafId = requestAnimationFrame(async () => {
      try {
        const barcodes = await this.detector.detect(video);
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue as string;
          this.stop();
          this.scanned.emit(value);
          return;
        }
      } catch { /* frame not ready yet */ }
      this.detect();
    });
  }

  stop(): void {
    this.scanning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.cdr.markForCheck();
  }

  close(): void {
    this.stop();
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
