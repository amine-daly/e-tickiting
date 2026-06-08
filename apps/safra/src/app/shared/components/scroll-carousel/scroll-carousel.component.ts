import {
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  Component,
  ElementRef,
  SimpleChanges,
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Subject } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-scroll-carousel',
  templateUrl: './scroll-carousel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .scroll-carousel-wrapper {
        position: relative;
        width: 100%;
        min-width: 0;
      }

      .scroll-carousel-wrapper.has-nav {
        padding-inline: clamp(2.75rem, 4vw, 4rem);
      }

      .scroll-carousel-wrapper.has-nav::before,
      .scroll-carousel-wrapper.has-nav::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: clamp(1.5rem, 3vw, 2.5rem);
        pointer-events: none;
        z-index: 2;
      }

      .scroll-carousel-wrapper.has-nav::before {
        left: 0;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0));
      }

      .scroll-carousel-wrapper.has-nav::after {
        right: 0;
        background: linear-gradient(270deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0));
      }

      .scroll-carousel-wrapper.is-marquee {
        overflow: hidden;
      }

      .scroll-carousel-track {
        display: flex;
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        cursor: grab;

        /* Hide scrollbar */
        scrollbar-width: none;
        -ms-overflow-style: none;
        &::-webkit-scrollbar {
          display: none;
        }
      }

      .scroll-carousel-track.is-marquee {
        overflow: visible;
        scroll-behavior: auto;
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        cursor: grab;
      }

      .scroll-carousel-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.875rem;
        height: 2.875rem;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, 0.85);
        border-radius: 999px;
        z-index: 11;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 249, 255, 0.82));
        color: var(--primary-color);
        box-shadow: 0 12px 24px rgba(34, 34, 51, 0.12);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease,
          opacity 0.18s ease;
      }

      .scroll-carousel-arrow i {
        font-size: 1.05rem;
        line-height: 1;
      }

      .scroll-carousel-arrow--left {
        left: 0.5rem;
      }

      .scroll-carousel-arrow--right {
        right: 0.5rem;
      }

      .scroll-carousel-arrow:hover {
        transform: translateY(-50%) scale(1.04);
        box-shadow: 0 16px 30px rgba(34, 34, 51, 0.16);
        background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(241, 244, 255, 0.92));
      }

      .scroll-carousel-arrow:active {
        transform: translateY(-50%) scale(0.98);
      }

      .scroll-carousel-arrow:focus-visible {
        outline: none;
        box-shadow:
          0 16px 30px rgba(34, 34, 51, 0.16),
          0 0 0 4px rgba(106, 90, 255, 0.18);
      }

      .scroll-carousel-arrow:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        box-shadow: none;
      }

      @media (max-width: 576px) {
        .scroll-carousel-wrapper.has-nav {
          padding-inline: 2.35rem;
        }

        .scroll-carousel-arrow {
          width: 2.4rem;
          height: 2.4rem;
        }

        .scroll-carousel-arrow--left {
          left: 0.25rem;
        }

        .scroll-carousel-arrow--right {
          right: 0.25rem;
        }
      }
    `,
  ],
})
export class ScrollCarouselComponent implements AfterViewInit, OnDestroy, OnChanges {
  private readonly destroy$ = new Subject<void>();

  /** Pixels to scroll per arrow click. */
  @Input() gap = 12;
  @Input() nav = true;
  @Input() scrollAmount = 200;
  @Input() autoScroll = false;
  @Input() autoScrollSpeed = 90;
  @Input() autoScrollResumeDelay = 1200;

  @ViewChild('track', { static: true }) trackRef!: ElementRef<HTMLElement>;

  canScrollLeft = false;
  canScrollRight = false;
  isRtl = false;

  private el!: HTMLElement;
  private wrapper!: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private rtlScrollType: 'default' | 'negative' | 'reverse' = 'reverse';

  /* ── drag state ── */
  private startX = 0;
  private startY = 0;
  private loopSpan = 0;
  private marqueeOffset = 0;
  private isDragging = false;
  private hasDragged = false;
  private scrollLeftStart = 0;
  private clickBlockUntil = 0;
  private autoScrollLastTs = 0;
  private marqueeOffsetStart = 0;
  private touchDragActive = false;
  private autoScrollPaused = false;
  private rafId: number | null = null;
  private readonly dragThresholdPx = 3;
  private isApplyingLoopChanges = false;
  private readonly touchDragThresholdPx = 8;
  private readonly clickBlockWindowMs = 280;
  private autoScrollRafId: number | null = null;
  private loopRefreshRafId: number | null = null;
  private autoStartRetryRafId: number | null = null;
  private autoScrollResumeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  /* ────────────── lifecycle ────────────── */

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.el) return;
    if (!changes['autoScroll']) return;
    this.scheduleLoopContentRefresh();
  }

  ngAfterViewInit(): void {
    this.el = this.trackRef.nativeElement;
    this.wrapper = this.el.parentElement as HTMLElement;
    this.rtlScrollType = this.detectRtlScrollType();

    /* this.modalService.rtl$.pipe(takeUntil(this.destroy$)).subscribe((rtl) => {
      this.isRtl = !!rtl;
      this.updateArrows();
      this.cdr.markForCheck();
    }); */

    this.zone.runOutsideAngular(() => {
      this.el.addEventListener('scroll', this.onScroll, { passive: true });

      /* Desktop drag */
      this.el.addEventListener('mousedown', this.onMouseDown);
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      this.el.addEventListener('mouseenter', this.onMouseEnter);
      this.el.addEventListener('mouseleave', this.onMouseLeave);
      this.el.addEventListener('touchstart', this.onTouchStart, { passive: true });
      this.el.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.el.addEventListener('touchend', this.onTouchEnd, { passive: true });
      this.el.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
      this.el.addEventListener('wheel', this.onWheel, { passive: true });

      /* Prevent native drag (images / links) – it hijacks the mouse
         event stream so we never receive mouseup. */
      this.el.addEventListener('dragstart', this.preventDefault);

      /* Swallow clicks after a drag */
      this.el.addEventListener('click', this.onClickCapture, true);

      /* Extra safety: reset drag on context-menu, window blur, or
         tab-visibility change – all of which can swallow mouseup. */
      document.addEventListener('contextmenu', this.resetDrag);
      window.addEventListener('blur', this.resetDrag);
      document.addEventListener('visibilitychange', this.resetDrag);

      /* Re-evaluate arrows when the container resizes or children change */
      this.resizeObserver = new ResizeObserver(() => {
        if (this.isApplyingLoopChanges) return;
        if (this.autoScroll) {
          this.scheduleLoopContentRefresh();
        } else {
          this.updateArrows();
        }
      });
      this.resizeObserver.observe(this.wrapper);

      this.mutationObserver = new MutationObserver((mutations) => {
        if (this.autoScroll && !this.isApplyingLoopChanges && this.shouldRefreshLoopForMutations(mutations)) {
          this.scheduleLoopContentRefresh();
        } else {
          this.updateArrows();
        }
      });
      // Only observe direct children changes of the track.
      this.mutationObserver.observe(this.el, { childList: true, subtree: false });
    });

    /* First evaluation after projected content renders */
    requestAnimationFrame(() => {
      this.ensureLoopContent();
      this.updateArrows();
      this.startAutoScroll();
    });
  }

  /* ────────────── template helpers ────────────── */

  scrollBy(offset: number): void {
    if (!this.el) return;
    const targetOffset = this.getVisualOffset() + (this.isRtl ? -offset : offset);
    this.setVisualOffset(targetOffset, 'smooth');
  }

  scrollByStep(direction: -1 | 1): void {
    this.scrollBy(direction * this.scrollAmount);
  }

  /* ────────────── arrow visibility ────────────── */

  private updateArrows(): void {
    if (this.autoScroll) {
      if (this.canScrollLeft || this.canScrollRight) {
        this.canScrollLeft = false;
        this.canScrollRight = false;
        this.cdr.detectChanges();
      }
      return;
    }

    if (!this.el) return;
    const maxOffset = this.getMaxOffset();
    const visualOffset = this.getVisualOffset();
    const left = this.isRtl ? visualOffset < maxOffset - 1 : visualOffset > 1;
    const right = this.isRtl ? visualOffset > 1 : visualOffset < maxOffset - 1;

    if (left !== this.canScrollLeft || right !== this.canScrollRight) {
      this.canScrollLeft = left;
      this.canScrollRight = right;
      this.cdr.detectChanges();
    }
  }

  /* ────────────── event handlers (arrow fns keep `this`) ────────────── */

  private onScroll = (): void => {
    if (this.autoScroll) return;
    this.updateArrows();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.pauseAutoScroll();
    this.isDragging = true;
    this.hasDragged = false;
    this.clickBlockUntil = 0;
    this.startX = e.clientX;
    this.scrollLeftStart = this.el.scrollLeft;
    this.marqueeOffsetStart = this.marqueeOffset;

    /* Kill CSS smooth-scroll during drag — this is the key fix for
       the "slow / heavy" feeling. Without it every scrollLeft assignment
       gets animated by the browser's smooth-scroll interpolation. */
    this.el.style.scrollBehavior = 'auto';
    this.el.style.cursor = 'grabbing';
    this.el.style.userSelect = 'none';
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    /* KEY FIX: if no mouse button is currently held, the browser ate
       our mouseup (e.g. alt-tab, drag-outside, alert dialog).
       Reset immediately so the carousel never gets "stuck". */
    if (e.buttons === 0) {
      this.resetDrag();
      return;
    }

    e.preventDefault();

    const dx = e.clientX - this.startX;
    if (Math.abs(dx) >= this.dragThresholdPx) {
      this.hasDragged = true;
    }

    /* Batch into one rAF so we don't over-paint */
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      if (this.autoScroll && this.loopSpan > 1) {
        const raw = this.marqueeOffsetStart - dx;
        this.marqueeOffset = ((raw % this.loopSpan) + this.loopSpan) % this.loopSpan;
        this.applyMarqueeTransform();
      } else {
        this.setRawScrollLeft(this.scrollLeftStart - dx);
      }
      this.rafId = null;
    });
  };

  private onMouseUp = (): void => {
    this.resetDrag();
    this.scheduleAutoScrollResume();
  };

  private onMouseEnter = (): void => {
    if (!this.autoScroll) return;
    this.pauseAutoScroll();
  };

  private onMouseLeave = (): void => {
    if (!this.autoScroll) return;
    this.scheduleAutoScrollResume();
  };

  private onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches?.[0];
    if (!touch) return;
    this.pauseAutoScroll();
    this.isDragging = true;
    this.hasDragged = false;
    this.touchDragActive = false;
    this.clickBlockUntil = 0;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.scrollLeftStart = this.el.scrollLeft;
    this.marqueeOffsetStart = this.marqueeOffset;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.isDragging) return;
    const touch = e.touches?.[0];
    if (!touch) return;

    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    const dragDistance = Math.abs(dx);

    if (!this.touchDragActive) {
      if (dragDistance < this.touchDragThresholdPx || dragDistance < Math.abs(dy)) {
        return;
      }
      this.touchDragActive = true;
      this.el.style.scrollBehavior = 'auto';
      this.el.style.cursor = 'grabbing';
      this.el.style.userSelect = 'none';
    }

    e.preventDefault();

    if (dragDistance >= this.touchDragThresholdPx) {
      this.hasDragged = true;
    }

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      if (this.autoScroll && this.loopSpan > 1) {
        const raw = this.marqueeOffsetStart - dx;
        this.marqueeOffset = ((raw % this.loopSpan) + this.loopSpan) % this.loopSpan;
        this.applyMarqueeTransform();
      } else {
        this.setRawScrollLeft(this.scrollLeftStart - dx);
      }
      this.rafId = null;
    });
  };

  private onTouchEnd = (): void => {
    this.resetDrag();
    this.scheduleAutoScrollResume();
  };

  private onWheel = (): void => {
    this.pauseAutoScroll();
    this.scheduleAutoScrollResume();
  };

  /** Central "stop dragging" routine – called from mouseup AND from
   *  every safety-net listener (blur, contextmenu, visibilitychange). */
  private resetDrag = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.touchDragActive = false;
    this.clickBlockUntil = this.hasDragged ? performance.now() + this.clickBlockWindowMs : 0;

    /* Restore smooth-scroll for arrow clicks */
    this.el.style.scrollBehavior = '';
    this.el.style.cursor = '';
    this.el.style.userSelect = '';

    /* Flush any pending rAF */
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  private preventDefault = (e: Event): void => {
    e.preventDefault();
  };

  /** Block click events that immediately follow a drag. */
  private onClickCapture = (e: MouseEvent): void => {
    if (this.hasDragged && performance.now() <= this.clickBlockUntil) {
      e.preventDefault();
      e.stopPropagation();
      this.hasDragged = false;
      this.clickBlockUntil = 0;
      return;
    }

    this.hasDragged = false;
    this.clickBlockUntil = 0;
    this.forwardClickFromLoopClone(e);
  };

  private forwardClickFromLoopClone(e: MouseEvent): void {
    if (!this.autoScroll) return;

    const trackItem = this.getTrackItemFromTarget(e.target);
    if (!trackItem || !trackItem.hasAttribute('data-loop-clone')) return;

    const itemIndex = trackItem.getAttribute('data-loop-item-index');
    if (itemIndex == null) return;

    const original = Array.from(this.el.children).find(
      (node) =>
        node instanceof HTMLElement &&
        !node.hasAttribute('data-loop-clone') &&
        node.getAttribute('data-loop-item-index') === itemIndex,
    ) as HTMLElement | undefined;
    if (!original) return;

    e.preventDefault();
    e.stopPropagation();
    original.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail: e.detail,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      }),
    );
  }

  private getTrackItemFromTarget(target: EventTarget | null): HTMLElement | null {
    let node = target instanceof HTMLElement ? target : null;
    while (node && node !== this.el) {
      if (node.parentElement === this.el) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.el?.removeEventListener('scroll', this.onScroll);
    this.el?.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.el?.removeEventListener('mouseenter', this.onMouseEnter);
    this.el?.removeEventListener('mouseleave', this.onMouseLeave);
    this.el?.removeEventListener('touchstart', this.onTouchStart);
    this.el?.removeEventListener('touchmove', this.onTouchMove);
    this.el?.removeEventListener('touchend', this.onTouchEnd);
    this.el?.removeEventListener('touchcancel', this.onTouchEnd);
    this.el?.removeEventListener('wheel', this.onWheel);
    this.el?.removeEventListener('dragstart', this.preventDefault);
    this.el?.removeEventListener('click', this.onClickCapture, true);
    document.removeEventListener('contextmenu', this.resetDrag);
    window.removeEventListener('blur', this.resetDrag);
    document.removeEventListener('visibilitychange', this.resetDrag);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.loopRefreshRafId) cancelAnimationFrame(this.loopRefreshRafId);
    if (this.autoStartRetryRafId) cancelAnimationFrame(this.autoStartRetryRafId);
    this.stopAutoScroll();
  }

  private startAutoScroll(): void {
    if (!this.autoScroll || this.autoScrollRafId !== null) return;

    // In marquee mode we wait until loop span is measured to avoid
    // the initial "stuck then smooth" behavior during first paint.
    if (this.autoScroll && this.loopSpan <= 1) {
      this.autoStartRetryRafId = requestAnimationFrame(() => {
        this.autoStartRetryRafId = null;
        this.startAutoScroll();
      });
      return;
    }

    this.autoScrollPaused = false;
    this.autoScrollLastTs = 0;
    this.zone.runOutsideAngular(() => {
      this.autoScrollRafId = requestAnimationFrame(this.runAutoScroll);
    });
  }

  private stopAutoScroll(): void {
    if (this.autoScrollRafId !== null) {
      cancelAnimationFrame(this.autoScrollRafId);
      this.autoScrollRafId = null;
    }
    if (this.autoStartRetryRafId) {
      cancelAnimationFrame(this.autoStartRetryRafId);
      this.autoStartRetryRafId = null;
    }
    if (this.autoScrollResumeTimer) {
      clearTimeout(this.autoScrollResumeTimer);
      this.autoScrollResumeTimer = null;
    }
  }

  private pauseAutoScroll(): void {
    if (!this.autoScroll) return;
    this.autoScrollPaused = true;
    this.autoScrollLastTs = 0;
    if (this.autoScrollResumeTimer) {
      clearTimeout(this.autoScrollResumeTimer);
      this.autoScrollResumeTimer = null;
    }
  }

  private scheduleAutoScrollResume(): void {
    if (!this.autoScroll) return;
    if (this.autoScrollResumeTimer) {
      clearTimeout(this.autoScrollResumeTimer);
    }
    this.autoScrollResumeTimer = setTimeout(() => {
      this.autoScrollPaused = false;
      this.autoScrollLastTs = 0;
    }, this.autoScrollResumeDelay);
  }

  private runAutoScroll = (timestamp: number): void => {
    if (!this.autoScroll) {
      this.autoScrollRafId = null;
      return;
    }

    if (!this.autoScrollPaused && !this.isDragging) {
      if (!this.autoScrollLastTs) {
        this.autoScrollLastTs = timestamp;
      }

      // Cap delta to avoid giant jumps after tab resumes or frame stalls.
      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - this.autoScrollLastTs) / 1000));
      this.autoScrollLastTs = timestamp;

      const speed = Math.max(1, this.autoScrollSpeed);
      if (this.autoScroll) {
        if (this.loopSpan > 1) {
          this.marqueeOffset = (this.marqueeOffset + speed * deltaSeconds) % this.loopSpan;
          this.applyMarqueeTransform();
        }
      } else {
        const maxOffset = this.getMaxOffset();
        if (maxOffset > 1) {
          const nextOffset = this.getVisualOffset() + speed * deltaSeconds;
          this.setVisualOffsetImmediate(nextOffset);
        }
      }
    } else {
      this.autoScrollLastTs = 0;
    }

    this.autoScrollRafId = requestAnimationFrame(this.runAutoScroll);
  };

  private getMaxOffset(): number {
    return Math.max(0, (this.el?.scrollWidth || 0) - (this.el?.clientWidth || 0));
  }

  private scheduleLoopContentRefresh(): void {
    if (!this.el) return;
    if (this.loopRefreshRafId) {
      cancelAnimationFrame(this.loopRefreshRafId);
    }
    this.loopRefreshRafId = requestAnimationFrame(() => {
      this.ensureLoopContent();
      this.updateArrows();
      this.loopRefreshRafId = null;
    });
  }

  private ensureLoopContent(): void {
    if (!this.el) return;

    const previousVisualOffset = this.getVisualOffset();
    this.isApplyingLoopChanges = true;
    this.removeLoopClones();

    if (!this.autoScroll) {
      this.resetMarqueeTransform();
      this.loopSpan = 0;
      this.marqueeOffset = 0;
      this.isApplyingLoopChanges = false;
      return;
    }

    const originals = Array.from(this.el.children).filter(
      (node) => node instanceof HTMLElement && !(node as HTMLElement).hasAttribute('data-loop-clone'),
    ) as HTMLElement[];

    originals.forEach((item, index) => {
      item.setAttribute('data-loop-item-index', `${index}`);
    });

    if (!originals.length) {
      this.loopSpan = 0;
      this.marqueeOffset = 0;
      this.isApplyingLoopChanges = false;
      return;
    }

    const originalSpan = this.computeOriginalSpan(originals);
    const viewportWidth = this.el.clientWidth;
    const hasOverflow = originalSpan > viewportWidth + 1;

    // If everything is already visible, avoid cloning/looping entirely.
    if (!hasOverflow) {
      this.loopSpan = 0;
      this.marqueeOffset = 0;
      this.isApplyingLoopChanges = false;
      return;
    }

    const firstOriginal = originals[0];

    const preFragment = document.createDocumentFragment();
    for (const [index, item] of originals.entries()) {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-loop-clone', '1');
      clone.setAttribute('data-loop-section', 'pre');
      clone.setAttribute('data-loop-item-index', `${index}`);
      clone.setAttribute('aria-hidden', 'true');
      preFragment.appendChild(clone);
    }
    this.el.insertBefore(preFragment, firstOriginal);

    const postFragment = document.createDocumentFragment();
    for (const [index, item] of originals.entries()) {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-loop-clone', '1');
      clone.setAttribute('data-loop-section', 'post');
      clone.setAttribute('data-loop-item-index', `${index}`);
      clone.setAttribute('aria-hidden', 'true');
      postFragment.appendChild(clone);
    }
    this.el.appendChild(postFragment);

    this.loopSpan = originalSpan + this.gap;
    this.marqueeOffset = this.loopSpan > 1 ? ((previousVisualOffset % this.loopSpan) + this.loopSpan) % this.loopSpan : 0;
    this.isApplyingLoopChanges = false;
    this.applyMarqueeTransform();
  }

  private shouldRefreshLoopForMutations(mutations: MutationRecord[]): boolean {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement && !node.hasAttribute('data-loop-clone')) {
          return true;
        }
      }

      for (const node of Array.from(mutation.removedNodes)) {
        if (node instanceof HTMLElement && !node.hasAttribute('data-loop-clone')) {
          return true;
        }
      }
    }
    return false;
  }

  private removeLoopClones(): void {
    const clones = Array.from(this.el.children).filter(
      (node) => node instanceof HTMLElement && (node as HTMLElement).hasAttribute('data-loop-clone'),
    ) as HTMLElement[];

    for (const clone of clones) {
      this.el.removeChild(clone);
    }
  }

  private computeOriginalSpan(originals: HTMLElement[]): number {
    if (!originals.length) return 0;

    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;

    for (const item of originals) {
      const left = item.offsetLeft;
      const right = left + item.offsetWidth;
      if (left < minLeft) minLeft = left;
      if (right > maxRight) maxRight = right;
    }

    const span = maxRight - minLeft;
    return span > 1 ? span : 0;
  }

  private getVisualOffset(): number {
    if (!this.el) return 0;
    if (this.autoScroll) return this.marqueeOffset;
    if (!this.isRtl) return this.el.scrollLeft;

    const maxOffset = this.getMaxOffset();
    switch (this.rtlScrollType) {
      case 'default':
        return maxOffset - this.el.scrollLeft;
      case 'negative':
        return -this.el.scrollLeft;
      default:
        return this.el.scrollLeft;
    }
  }

  private setVisualOffset(value: number, behavior: ScrollBehavior): void {
    if (!this.el) return;
    const maxOffset = this.getMaxOffset();
    const nextOffset = Math.min(Math.max(value, 0), maxOffset);

    if (!this.isRtl) {
      this.el.scrollTo({ left: nextOffset, behavior });
      return;
    }

    switch (this.rtlScrollType) {
      case 'default':
        this.el.scrollTo({ left: maxOffset - nextOffset, behavior });
        break;
      case 'negative':
        this.el.scrollTo({ left: -nextOffset, behavior });
        break;
      default:
        this.el.scrollTo({ left: nextOffset, behavior });
        break;
    }
  }

  private setRawScrollLeft(value: number): void {
    if (!this.el) return;
    this.el.scrollLeft = value;
  }

  private setVisualOffsetImmediate(value: number): void {
    if (this.autoScroll) return;
    if (!this.el) return;
    const maxOffset = this.getMaxOffset();
    const nextOffset = Math.min(Math.max(value, 0), maxOffset);

    if (!this.isRtl) {
      this.el.scrollLeft = nextOffset;
      return;
    }

    switch (this.rtlScrollType) {
      case 'default':
        this.el.scrollLeft = maxOffset - nextOffset;
        break;
      case 'negative':
        this.el.scrollLeft = -nextOffset;
        break;
      default:
        this.el.scrollLeft = nextOffset;
        break;
    }
  }

  private detectRtlScrollType(): 'default' | 'negative' | 'reverse' {
    const container = document.createElement('div');
    const content = document.createElement('div');

    container.dir = 'rtl';
    container.style.width = '4px';
    container.style.height = '1px';
    container.style.position = 'absolute';
    container.style.top = '-1000px';
    container.style.overflow = 'scroll';
    content.style.width = '8px';
    content.style.height = '1px';

    container.appendChild(content);
    document.body.appendChild(container);

    let type: 'default' | 'negative' | 'reverse' = 'reverse';
    if (container.scrollLeft > 0) {
      type = 'default';
    } else {
      container.scrollLeft = 1;
      if (container.scrollLeft === 0) {
        type = 'negative';
      }
    }

    document.body.removeChild(container);
    return type;
  }

  private applyMarqueeTransform(): void {
    if (!this.el || this.loopSpan <= 0) return;
    // Keep originals as the visible baseline and move continuously around them.
    const x = -this.loopSpan - this.marqueeOffset;
    this.el.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  private resetMarqueeTransform(): void {
    if (!this.el) return;
    this.el.style.transform = '';
  }
}
