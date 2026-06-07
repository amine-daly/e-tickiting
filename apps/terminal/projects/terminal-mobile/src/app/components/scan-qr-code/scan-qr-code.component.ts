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
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { environment } from 'src/environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ScanState = 'idle' | 'scanning' | 'success' | 'rejected' | 'manual';
export type RejectionReason = 'ALREADY_SCANNED' | 'WRONG_TRIP' | 'INVALID_TICKET';

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

const REJECTION_DISPLAY_MAP: Readonly<Record<RejectionReason, RejectionConfig>> = {
  ALREADY_SCANNED: {
    headline: '❌ STOP: TICKET ALREADY SCANNED!',
    subtextFn: (name) => `This passenger${name ? ` (${name})` : ''} was already boarded.`,
  },
  WRONG_TRIP: {
    headline: '❌ WRONG BUS!',
    subtextFn: () => 'This ticket is for a different trip or destination. Do not let them board.',
  },
  INVALID_TICKET: {
    headline: '❌ INVALID TICKET!',
    subtextFn: () => 'Status: CANCELLED / UNPAID. Direct the passenger to the ticket office.',
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
  @Output() closed  = new EventEmitter<void>();
  /** Fires the raw QR/reference value — kept for parent AppComponent navigation. */
  @Output() scanned = new EventEmitter<string>();

  // ── UI state ───────────────────────────────────────────────────────────────

  state: ScanState = 'idle';
  scanResponse: ScanResponse | null = null;
  torchEnabled  = false;
  manualTicketId = '';
  isSubmitting   = false;
  permissionError: string | null = null;

  /**
   * True only when running inside a real Capacitor native shell (Android/iOS).
   * False in all browser / PWA contexts.
   */
  readonly isNative = Capacitor.isNativePlatform();

  // ── Teardown ───────────────────────────────────────────────────────────────

  private readonly destroy$  = new Subject<void>();
  private audioCtx: AudioContext | null = null;
  /** Holds the video stream opened for browser torch support. */
  private torchStream: MediaStream | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.isNative) {
      this.initMlKit();
    }
    // In browser context nothing to init — the scan button routes to manual entry
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
    return reason ? (REJECTION_DISPLAY_MAP[reason] ?? REJECTION_DISPLAY_MAP.INVALID_TICKET) : null;
  }

  get rejectionSubtext(): string {
    return this.rejectionConfig?.subtextFn(this.scanResponse?.passengerName) ?? '';
  }

  // ── ML Kit initialisation (native only) ───────────────────────────────────

  private async initMlKit(): Promise<void> {
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== 'granted') {
          this.permissionError = 'Camera permission denied. Please enable it in device settings.';
          this.cdr.markForCheck();
          return;
        }
      }

      // Ensure the Google Barcode Scanner module is installed on first use
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }
    } catch {
      this.permissionError = 'Could not initialise barcode scanner.';
    } finally {
      this.cdr.markForCheck();
    }
  }

  // ── Torch / Flashlight ────────────────────────────────────────────────────

  async toggleTorch(): Promise<void> {
    if (this.isNative) {
      await this.toggleNativeTorch();
    } else {
      await this.toggleBrowserTorch();
    }
  }

  private async toggleNativeTorch(): Promise<void> {
    try {
      await BarcodeScanner.toggleTorch();
      const { enabled } = await BarcodeScanner.isTorchEnabled();
      this.torchEnabled = enabled;
      this.cdr.markForCheck();
    } catch {
      // Hardware torch not available on this device
    }
  }

  /**
   * Browser fallback: opens a back-camera stream and sets the torch constraint.
   * Works on Chrome Android and most modern mobile browsers.
   */
  private async toggleBrowserTorch(): Promise<void> {
    try {
      if (!this.torchEnabled) {
        this.torchStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = this.torchStream.getVideoTracks()[0];
        // `torch` is a non-standard but widely supported constraint on mobile Chrome
        await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
        this.torchEnabled = true;
      } else {
        this.releaseTorchStream();
        this.torchEnabled = false;
      }
      this.cdr.markForCheck();
    } catch {
      // Torch constraint not supported on this device/browser
      this.releaseTorchStream();
      this.torchEnabled = false;
      this.cdr.markForCheck();
    }
  }

  private releaseTorchStream(): void {
    this.torchStream?.getTracks().forEach((t) => t.stop());
    this.torchStream = null;
  }

  // ── Scanning ───────────────────────────────────────────────────────────────

  async startScan(): Promise<void> {
    if (this.isSubmitting) return;

    if (!this.isNative) {
      // ML Kit is a native-only plugin. In a browser context, fall back to
      // manual entry so the workflow is never blocked.
      this.openManualEntry();
      return;
    }

    if (this.permissionError) return;

    this.state = 'scanning';
    this.cdr.markForCheck();

    try {
      // scan() opens the native Google Barcode Scanner Activity — no transparent-WebView hacks needed.
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });

      if (barcodes.length > 0) {
        const rawValue = barcodes[0].rawValue;
        this.scanned.emit(rawValue);
        this.processTicketId(rawValue);
      } else {
        // User pressed back in the native scanner
        this.state = 'idle';
        this.cdr.markForCheck();
      }
    } catch {
      this.state = 'idle';
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
    this.scanned.emit(id);
    this.processTicketId(id);
  }

  // ── Acknowledge rejection ──────────────────────────────────────────────────

  acknowledgeRejection(): void {
    this.scanResponse   = null;
    this.state          = 'idle';
    this.manualTicketId = '';
    this.cdr.markForCheck();
  }

  close(): void {
    this.closed.emit();
  }

  // ── Core validation pipeline ───────────────────────────────────────────────

  /**
   * Calls `POST /api/bookings/{reference}/board`.
   * QR codes encode the ticket reference (e.g. "DA4FA48B2672"), which the
   * backend resolves before marking the ticket as BOARDED.
   */
  private processTicketId(ticketReference: string): void {
    this.isSubmitting = true;
    this.state = 'scanning';
    this.cdr.markForCheck();

    this.http
      .post<BookingBoardResponse>(
        `${environment.apiBase}/bookings/${encodeURIComponent(ticketReference.trim())}/board`,
        {},
      )
      .pipe(
        map((boardRes) => this.mapBoardSuccess(boardRes)),
        catchError((err) => of(this.mapBoardError(err))),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((response) => this.handleResponse(response));
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

  // ── HTTP response adapters ────────────────────────────────────────────────

  private mapBoardSuccess(board: BookingBoardResponse): ScanResponse {
    return {
      success: true,
      passengerName: this.extractGuestName(board),
      seatNumber: board.seatNo ?? undefined,
    };
  }

  private mapBoardError(err: HttpErrorLike): ScanResponse {
    return { success: false, reason: this.resolveRejectionReason(err) };
  }

  private resolveRejectionReason(err: HttpErrorLike): RejectionReason {
    switch (err?.status) {
      case 403:
        // ForbiddenException: ticket belongs to a different company
        return 'WRONG_TRIP';

      case 409: {
        // ConflictException thrown by BookingService.boardTicket():
        //   "INVALID_TICKET_TRANSITION: ticket is BOARDED, expected CONFIRMED"
        const msg: string = err?.error?.message ?? '';
        return msg.includes('BOARDED') ? 'ALREADY_SCANNED' : 'INVALID_TICKET';
      }

      default:
        // 404 (not found), 400 (bad request), 500 (server error)
        return 'INVALID_TICKET';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private extractGuestName(t: { guestFirstName?: string; guestLastName?: string }): string | undefined {
    const parts = [t.guestFirstName, t.guestLastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : undefined;
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
      const ctx  = this.getAudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
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

/** Minimal shape of `BookingResponse` from POST /api/bookings/{reference}/board. */
interface BookingBoardResponse {
  id: string;
  guestFirstName?: string;
  guestLastName?: string;
  passengerId?: string;
  seatNo?: string;
  status: string;
}

/** Minimal shape of an Angular HttpErrorResponse for switch-casing. */
interface HttpErrorLike {
  status: number;
  error?: { message?: string };
}
