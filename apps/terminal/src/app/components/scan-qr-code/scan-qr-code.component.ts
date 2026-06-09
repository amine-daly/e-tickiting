import {
  Input,
  OnInit,
  Output,
  Component,
  OnDestroy,
  EventEmitter,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, timer, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import {
  Barcode,
  BarcodeFormat,
  BarcodeScanner,
  LensFacing,
} from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { environment } from 'src/environments/environment';
import { DialogService } from '../../shared/services/dialog.service';
import { BarcodeScanningModalComponent } from '../../shared/components/barcode-scanning-modal/barcode-scanning-modal.component';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ScanState = 'idle' | 'scanning' | 'success' | 'rejected' | 'manual';
export type RejectionReason =
  | 'ALREADY_SCANNED'
  | 'WRONG_TRIP'
  | 'INVALID_TICKET';

export interface ScanResponse {
  success: boolean;
  reason?: RejectionReason;
  passengerName?: string;
  seatNumber?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rejection copy — switch-map so we never nest if/else chains in the template
// ─────────────────────────────────────────────────────────────────────────────

interface RejectionConfig {
  headline: string;
  subtextFn: (name?: string) => string;
}

const REJECTION_DISPLAY_MAP: Readonly<
  Record<RejectionReason, RejectionConfig>
> = {
  ALREADY_SCANNED: {
    headline: '❌ STOP: TICKET ALREADY SCANNED!',
    subtextFn: (name) =>
      `This passenger${name ? ` (${name})` : ''} was already boarded.`,
  },
  WRONG_TRIP: {
    headline: '❌ WRONG BUS!',
    subtextFn: () =>
      'This ticket is for a different trip or destination. Do not let them board.',
  },
  INVALID_TICKET: {
    headline: '❌ INVALID TICKET!',
    subtextFn: () =>
      'Status: CANCELLED / UNPAID. Direct the passenger to the ticket office.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-scan-qr-code',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan-qr-code.component.html',
  styleUrls: ['./scan-qr-code.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanQrCodeComponent implements OnInit, OnDestroy {
  @Input() tripLabel = '';
  @Output() closed = new EventEmitter<void>();
  /** Fires the raw QR/reference value — kept for parent AppComponent navigation. */
  @Output() scanned = new EventEmitter<string>();

  // ── UI state ───────────────────────────────────────────────────────────────

  state: ScanState = 'idle';
  scanResponse: ScanResponse | null = null;
  torchEnabled = false;
  manualTicketId = '';
  isSubmitting = false;
  isScanning = false;
  permissionError: string | null = null;

  /**
   * True only when running inside a real Capacitor native shell (Android/iOS).
   * False in all browser / PWA contexts.
   */
  readonly isNative = Capacitor.isNativePlatform();

  // ── Teardown ───────────────────────────────────────────────────────────────

  private readonly destroy$ = new Subject<void>();
  private audioCtx: AudioContext | null = null;
  /** Holds the video stream opened for browser torch support. */
  private torchStream: MediaStream | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly dialogService: DialogService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Camera permissions are requested when the user taps Scan (see startScan).
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.audioCtx?.close();
    this.releaseTorchStream();
  }

  // ── Derived getters ────────────────────────────────────────────────────────

  get rejectionConfig(): RejectionConfig | null {
    const reason = this.scanResponse?.reason;
    return reason
      ? (REJECTION_DISPLAY_MAP[reason] ?? REJECTION_DISPLAY_MAP.INVALID_TICKET)
      : null;
  }

  get rejectionSubtext(): string {
    return (
      this.rejectionConfig?.subtextFn(this.scanResponse?.passengerName) ?? ''
    );
  }

  // ── Camera permissions ────────────────────────────────────────────────────

  private async ensureCameraPermission(): Promise<boolean> {
    const status = await BarcodeScanner.checkPermissions();
    if (status.camera === 'granted') {
      this.permissionError = null;
      return true;
    }

    const requestResult = await BarcodeScanner.requestPermissions();
    if (requestResult.camera === 'granted') {
      this.permissionError = null;
      return true;
    }

    this.permissionError =
      'Camera permission denied. Please enable it in device settings.';
    this.cdr.markForCheck();
    return false;
  }

  // ── Torch / Flashlight (browser only — native torch lives in the scan modal) ─

  async toggleTorch(): Promise<void> {
    if (this.isNative) return;
    await this.toggleBrowserTorch();
  }

  private async toggleBrowserTorch(): Promise<void> {
    try {
      if (!this.torchEnabled) {
        this.torchStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = this.torchStream.getVideoTracks()[0];
        await track.applyConstraints({
          advanced: [{ torch: true } as MediaTrackConstraintSet],
        });
        this.torchEnabled = true;
      } else {
        this.releaseTorchStream();
        this.torchEnabled = false;
      }
      this.cdr.markForCheck();
    } catch {
      this.releaseTorchStream();
      this.torchEnabled = false;
      this.cdr.markForCheck();
    }
  }

  private releaseTorchStream(): void {
    this.torchStream?.getTracks().forEach((t) => t.stop());
    this.torchStream = null;
  }

  // ── Scanning (Loyalcraft pattern: startScan + transparent modal) ───────────

  async startScan(): Promise<void> {
    if (this.isSubmitting || this.isScanning) return;

    const granted = await this.ensureCameraPermission();
    if (!granted) {
      if (!this.isNative) {
        this.openManualEntry();
      }
      return;
    }

    this.isScanning = true;
    this.cdr.markForCheck();

    try {
      const modal = await this.dialogService.showModal({
        component: BarcodeScanningModalComponent,
        cssClass: 'barcode-scanning-modal',
        showBackdrop: false,
        componentProps: {
          formats: [BarcodeFormat.QrCode],
          lensFacing: LensFacing.Back,
          title: 'Scan Ticket QR',
        },
      });

      const result = await modal.onDidDismiss();
      const barcode: Barcode | undefined = result.data?.barcode;

      if (barcode) {
        const scannedValue = barcode.displayValue || barcode.rawValue || '';
        if (scannedValue) {
          this.processTicketRef(scannedValue);
        }
      }
    } catch (err: unknown) {
      console.error('QR scan error:', err);
      this.permissionError = 'Could not open the camera scanner.';
      this.cdr.markForCheck();
    } finally {
      this.isScanning = false;
      this.cdr.markForCheck();
    }
  }

  // ── Manual entry ───────────────────────────────────────────────────────────

  openManualEntry(): void {
    this.state = 'manual';
    this.manualTicketId = '';
    this.cdr.markForCheck();
  }

  cancelManualEntry(): void {
    this.state = 'idle';
    this.manualTicketId = '';
    this.cdr.markForCheck();
  }

  submitManual(): void {
    const id = this.manualTicketId.trim();
    if (!id || this.isSubmitting) return;
    this.processTicketRef(id);
  }

  // ── Acknowledge rejection ──────────────────────────────────────────────────

  acknowledgeRejection(): void {
    this.scanResponse = null;
    this.state = 'idle';
    this.manualTicketId = '';
    this.cdr.markForCheck();
  }

  close(): void {
    this.closed.emit();
  }

  // ── Core validation pipeline ───────────────────────────────────────────────

  /**
   * Single-call boarding pipeline: POST /api/bookings/scan
   * Body: { reference: "2865145EF14E" } — the value encoded in the QR code.
   * The backend resolves the reference, boards the ticket, and returns the
   * canonical ScanResponse (success + passenger info, or rejection reason).
   */
  private processTicketRef(ticketReference: string): void {
    this.isSubmitting = true;
    this.state = 'scanning';
    this.cdr.markForCheck();

    this.http
      .post<BackendScanResponse>(`${environment.apiBase}/bookings/scan`, {
        reference: ticketReference.trim(),
      })
      .pipe(
        map((res) => this.mapScanResponse(res)),
        catchError(() =>
          of<ScanResponse>({ success: false, reason: 'INVALID_TICKET' }),
        ),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((response) => {
        if (response.success) {
          this.scanned.emit(ticketReference.trim());
        }
        this.handleResponse(response);
      });
  }

  private mapScanResponse(res: BackendScanResponse): ScanResponse {
    return {
      success: res.success,
      reason: res.reason,
      passengerName: res.passengerName,
      seatNumber: res.seatNumber,
    };
  }

  // ── Response handlers ──────────────────────────────────────────────────────

  private handleResponse(response: ScanResponse): void {
    this.scanResponse = response;
    response.success ? this.handleSuccess() : this.handleRejection();
    this.cdr.markForCheck();
  }

  private handleSuccess(): void {
    this.state = 'success';
    this.playSound('success');

    timer(2000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.scanResponse = null;
        this.state = 'idle';
        this.cdr.markForCheck();
      });
  }

  private handleRejection(): void {
    this.state = 'rejected';
    this.playSound('error');
    this.triggerHaptics();
  }

  // ── Audio (Web Audio API) ─────────────────────────────────────────────────

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playSound(type: 'success' | 'error'): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          1320,
          ctx.currentTime + 0.12,
        );
        gain.gain.setValueAtTime(0.55, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.55);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.7, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.7);
      }

      osc.onended = () => gain.disconnect();
    } catch {
      // Web Audio API unavailable
    }
  }

  // ── Haptics ───────────────────────────────────────────────────────────────

  private async triggerHaptics(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await Haptics.vibrate({ duration: 500 });
    } catch {
      // Haptics not supported (browser or device without vibration)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private DTOs — not exported; only used within this file
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors POST /api/bookings/scan response body from the backend. */
interface BackendScanResponse {
  success: boolean;
  reason?: RejectionReason;
  passengerName?: string;
  seatNumber?: string;
}
