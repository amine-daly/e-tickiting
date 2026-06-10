import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  Output,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bottom-sheet.component.html',
  styleUrls: ['./bottom-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BottomSheetComponent implements OnDestroy {
  @ViewChild('sheet', { static: false }) private sheetRef?: ElementRef<HTMLElement>;

  @Input() ariaLabel = '';
  @Input() height = '100vh';
  @Input() edgeToEdge = false;

  @Output() close = new EventEmitter<void>();

  public shouldRender = false;
  public isVisible = false;

  private _open = false;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private portalHost: HTMLElement | null = null;
  private isDragging = false;
  private dragStartY = 0;
  private dragCurrentY = 0;
  private dragStartTime = 0;
  private removeMoveListener?: () => void;
  private removeUpListener?: () => void;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

  @Input()
  set open(value: boolean) {
    if (value === this._open) {
      return;
    }
    this._open = value;
    if (value) {
      this.showSheet();
    } else {
      this.hideSheet('input');
    }
  }

  get open(): boolean {
    return this._open;
  }

  onBackdropClick(): void {
    if (this.isDragging) {
      return;
    }
    this.requestClose();
  }

  onHandlePointerDown(event: PointerEvent): void {
    if (!this.shouldRender) {
      return;
    }
    const sheet = this.sheetRef?.nativeElement;
    if (!sheet) {
      return;
    }

    this.clearCloseTimer();
    this.cleanupDragListeners();
    this.isDragging = true;
    this.dragStartY = event.clientY;
    this.dragCurrentY = event.clientY;
    this.dragStartTime = Date.now();

    sheet.style.transition = 'none';
    if (typeof (event.target as Element)?.setPointerCapture === 'function') {
      (event.target as Element).setPointerCapture(event.pointerId);
    }

    this.removeMoveListener = this.renderer.listen(this.doc, 'pointermove', (moveEvent: PointerEvent) => {
      this.onHandlePointerMove(moveEvent);
    });
    this.removeUpListener = this.renderer.listen(this.doc, 'pointerup', (upEvent: PointerEvent) => {
      this.onHandlePointerUp(upEvent);
    });
  }

  requestClose(): void {
    if (!this.shouldRender) {
      return;
    }
    this.hideSheet('internal');
    this.close.emit();
  }

  private showSheet(): void {
    this.clearCloseTimer();
    this.shouldRender = true;
    this.cdr.detectChanges();
    this.attachToBody();
    requestAnimationFrame(() => {
      this.isVisible = true;
      this.cdr.detectChanges();
      this.animateSheetIn();
    });
  }

  private hideSheet(source: 'input' | 'internal'): void {
    if (!this.shouldRender) {
      return;
    }
    if (source === 'internal') {
      this._open = false;
    }
    this.isVisible = false;
    this.cdr.detectChanges();
    this.animateSheetOut();
  }

  private animateSheetIn(): void {
    const el = this.sheetRef?.nativeElement;
    if (!el) {
      return;
    }
    el.style.transition = 'transform 0.35s ease';
    el.style.transform = 'translate3d(0, 0, 0)';
  }

  private onHandlePointerMove(event: PointerEvent): void {
    if (!this.isDragging) {
      return;
    }

    const el = this.sheetRef?.nativeElement;
    if (!el) {
      return;
    }

    this.dragCurrentY = event.clientY;
    const deltaY = Math.max(0, this.dragCurrentY - this.dragStartY);
    el.style.transform = `translate3d(0, ${deltaY}px, 0)`;
  }

  private onHandlePointerUp(event: PointerEvent): void {
    if (!this.isDragging) {
      return;
    }

    this.dragCurrentY = event.clientY;
    const elapsedMs = Math.max(1, Date.now() - this.dragStartTime);
    const deltaY = Math.max(0, this.dragCurrentY - this.dragStartY);
    const velocity = deltaY / elapsedMs; // px/ms
    const sheet = this.sheetRef?.nativeElement;

    this.isDragging = false;
    this.cleanupDragListeners();

    if (!sheet) {
      return;
    }

    const threshold = Math.max(80, sheet.offsetHeight * 0.22);
    const fastSwipe = velocity > 0.7 && deltaY > 24;

    if (deltaY >= threshold || fastSwipe) {
      this.hideSheet('internal');
      this.close.emit();
      return;
    }

    sheet.style.transition = 'transform 0.22s ease-out';
    sheet.style.transform = 'translate3d(0, 0, 0)';
  }

  private animateSheetOut(): void {
    const el = this.sheetRef?.nativeElement;
    if (el) {
      const height = el.offsetHeight;
      el.style.transition = 'transform 0.35s ease';
      el.style.transform = `translate3d(0, ${height}px, 0)`;
    }
    this.closeTimer = setTimeout(() => {
      this.shouldRender = false;
      this.cdr.detectChanges();
      this.resetSheetTransform();
      this.detachFromBody();
      this.clearCloseTimer();
    }, 350);
  }

  private resetSheetTransform(): void {
    const el = this.sheetRef?.nativeElement;
    if (!el) {
      return;
    }
    el.style.transition = '';
    el.style.transform = '';
  }

  /** Move the host element to document.body so it escapes ion-content containment */
  private attachToBody(): void {
    if (this.portalHost) {
      return;
    }
    const host = this.el.nativeElement;
    this.portalHost = host;
    this.renderer.appendChild(this.doc.body, host);
  }

  /** Return the host element to its original position (or just remove from body) */
  private detachFromBody(): void {
    if (!this.portalHost) {
      return;
    }
    try {
      this.renderer.removeChild(this.doc.body, this.portalHost);
    } catch {
      // already detached
    }
    this.portalHost = null;
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
  }

  private cleanupDragListeners(): void {
    if (this.removeMoveListener) {
      this.removeMoveListener();
      this.removeMoveListener = undefined;
    }
    if (this.removeUpListener) {
      this.removeUpListener();
      this.removeUpListener = undefined;
    }
  }
  
  ngOnDestroy(): void {
    this.clearCloseTimer();
    this.cleanupDragListeners();
    this.detachFromBody();
  }
}
