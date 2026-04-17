import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BusService } from '../bus.service';
import { AlertService } from 'src/app/core/services/alert.service';
import {
  BusType,
  LayoutElement,
  LayoutElementType,
  LayoutTemplate,
} from 'src/app/core/models/bus.model';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';

type ToolType = LayoutElementType | 'ERASER';
type DeckSide = 'lower' | 'upper';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    ToolbarComponent,
  ],
  selector: 'app-layout-builder',
  templateUrl: './layout-builder.component.html',
  styleUrls: ['./layout-builder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  bus: BusType;
  gridColumns = 5;
  gridRows = 14;
  hasDecks = false;
  activeDeck: DeckSide = 'lower';
  selectedTool: ToolType | null = LayoutElementType.SEAT;
  nextSeatNo = 1;
  editingSeatKey: string | null = null;
  editingSeatValue = '';
  isSaving = false;
  isDirty = false;
  isLocked = false;

  lowerDeck = new Map<string, LayoutElement>();
  upperDeck = new Map<string, LayoutElement>();

  /** ghost tracking */
  ghostKey: string | null = null;

  readonly tools: { type: ToolType; key: string; icon: string }[] = [
    { type: LayoutElementType.SEAT, key: 'S', icon: 'ki-duotone ki-tag' },
    { type: LayoutElementType.DRIVER, key: 'W', icon: 'ki-duotone ki-car' },
    {
      type: LayoutElementType.DOOR,
      key: 'D',
      icon: 'ki-duotone ki-entrance-left',
    },
    {
      type: LayoutElementType.STAIRS,
      key: '^',
      icon: 'ki-duotone ki-arrow-up',
    },
    { type: LayoutElementType.TOILET, key: 'T', icon: 'ki-duotone ki-drop' },
    { type: 'ERASER', key: 'X', icon: 'ki-duotone ki-cross-circle' },
  ];

  readonly columnHeaders: Record<number, string> = {
    1: 'BUSES.LAYOUT.COLUMN_HEADERS.1',
    2: 'BUSES.LAYOUT.COLUMN_HEADERS.2',
    3: 'BUSES.LAYOUT.COLUMN_HEADERS.3',
    4: 'BUSES.LAYOUT.COLUMN_HEADERS.4',
    5: 'BUSES.LAYOUT.COLUMN_HEADERS.5',
  };

  /** Helper arrays for *ngFor */
  get rowArray(): number[] {
    return Array.from({ length: this.gridRows }, (_, i) => i + 1);
  }

  get colArray(): number[] {
    return Array.from({ length: this.gridColumns }, (_, i) => i + 1);
  }

  get activeDeckMap(): Map<string, LayoutElement> {
    return this.activeDeck === 'lower' ? this.lowerDeck : this.upperDeck;
  }

  get seatCount(): number {
    let count = 0;
    this.lowerDeck.forEach((e) => {
      if (e.type === LayoutElementType.SEAT) count++;
    });
    this.upperDeck.forEach((e) => {
      if (e.type === LayoutElementType.SEAT) count++;
    });
    return count;
  }

  constructor(
    private router: Router,
    private alert: AlertService,
    private busService: BusService,
    private pageInfo: PageInfoService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.pageInfo.setTitle(this.translate.instant('BUSES.LAYOUT.TITLE'));

    this.busService.bus$.pipe(takeUntil(this.destroy$)).subscribe((bus) => {
      this.bus = bus;

      if (bus?.layoutTemplate) {
        this.loadFromTemplate(bus?.layoutTemplate);
      } else {
        this.loadFromTemplate(buildDefaultTunisianLayout());
      }

      this.recalcNextSeatNo();
      this.cdr.markForCheck();
    });

    this.busService
      .isBusLocked(this.bus?.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((locked) => {
        this.isLocked = locked;
        this.cdr.markForCheck();
      });
  }

  /* ═══════ Keyboard shortcuts ═══════ */

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.isLocked || this.editingSeatKey) return;
    const key = event.key.toUpperCase();
    const mapping: Record<string, ToolType> = {
      S: LayoutElementType.SEAT,
      W: LayoutElementType.DRIVER,
      D: LayoutElementType.DOOR,
      T: LayoutElementType.TOILET,
      X: 'ERASER',
    };
    if (key === '^' || key === '6') {
      this.selectedTool = LayoutElementType.STAIRS;
    } else if (mapping[key]) {
      this.selectedTool = mapping[key];
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /* ═══════ Tool selection ═══════ */

  selectTool(tool: ToolType): void {
    if (this.isLocked) return;
    this.selectedTool = tool;
  }

  isToolSelected(tool: ToolType): boolean {
    return this.selectedTool === tool;
  }

  toolLabel(type: ToolType): string {
    return type === 'ERASER'
      ? 'BUSES.LAYOUT.TOOL.ERASER'
      : `BUSES.LAYOUT.TOOL.${type}`;
  }

  /* ═══════ Grid cell helpers ═══════ */

  cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  getElement(col: number, row: number): LayoutElement | undefined {
    return this.activeDeckMap.get(this.cellKey(col, row));
  }

  cellClass(col: number, row: number): string {
    const el = this.getElement(col, row);
    if (el) return `element-${el.type.toLowerCase()}`;
    return 'cell-empty';
  }

  cellLabel(col: number, row: number): string {
    const el = this.getElement(col, row);
    if (!el) return '';
    if (el.type === LayoutElementType.SEAT) return el.seatNo || '';
    return '';
  }

  /* ═══════ Hover ghost ═══════ */

  onCellEnter(col: number, row: number): void {
    if (this.isLocked || !this.selectedTool) return;
    this.ghostKey = this.cellKey(col, row);
  }

  onCellLeave(): void {
    this.ghostKey = null;
  }

  isGhost(col: number, row: number): boolean {
    return this.ghostKey === this.cellKey(col, row);
  }

  ghostClass(col: number, row: number): string {
    if (!this.isGhost(col, row) || !this.selectedTool) return '';
    const el = this.getElement(col, row);
    if (this.selectedTool === 'ERASER') {
      return el ? 'ghost-eraser' : '';
    }
    return el ? '' : 'ghost-preview ghost-' + this.selectedTool.toLowerCase();
  }

  /* ═══════ Click-to-place ═══════ */

  onCellClick(col: number, row: number): void {
    if (this.isLocked) return;
    const key = this.cellKey(col, row);
    const existing = this.activeDeckMap.get(key);

    // If clicking on an existing SEAT and tool is SEAT → start rename
    if (
      existing?.type === LayoutElementType.SEAT &&
      this.selectedTool === LayoutElementType.SEAT
    ) {
      this.startSeatEdit(key, existing.seatNo || '');
      return;
    }

    if (!this.selectedTool) return;

    if (this.selectedTool === 'ERASER') {
      if (existing) {
        this.activeDeckMap.delete(key);
        this.isDirty = true;
        this.recalcNextSeatNo();
        this.cdr.markForCheck();
      }
      return;
    }

    // Max 1 DRIVER per deck
    if (this.selectedTool === LayoutElementType.DRIVER) {
      const existingDriver = Array.from(this.activeDeckMap.values()).find(
        (e) => e.type === LayoutElementType.DRIVER,
      );
      if (
        existingDriver &&
        this.cellKey(existingDriver.gridX, existingDriver.gridY) !== key
      ) {
        const driverKey = this.cellKey(
          existingDriver.gridX,
          existingDriver.gridY,
        );
        this.activeDeckMap.delete(driverKey);
      }
    }

    // Max 1 TOILET per deck
    if (this.selectedTool === LayoutElementType.TOILET) {
      const existingToilet = Array.from(this.activeDeckMap.values()).find(
        (e) => e.type === LayoutElementType.TOILET,
      );
      if (
        existingToilet &&
        this.cellKey(existingToilet.gridX, existingToilet.gridY) !== key
      ) {
        const toiletKey = this.cellKey(
          existingToilet.gridX,
          existingToilet.gridY,
        );
        this.activeDeckMap.delete(toiletKey);
      }
    }

    const element: LayoutElement = {
      type: this.selectedTool as LayoutElementType,
      seatNo:
        this.selectedTool === LayoutElementType.SEAT
          ? String(this.nextSeatNo)
          : null,
      gridX: col,
      gridY: row,
    };

    this.activeDeckMap.set(key, element);
    this.isDirty = true;

    if (this.selectedTool === LayoutElementType.SEAT) {
      this.nextSeatNo++;
    }
    this.recalcNextSeatNo();
    this.cdr.markForCheck();
  }

  /* ═══════ Right-click erase ═══════ */

  onCellContext(event: MouseEvent, col: number, row: number): void {
    event.preventDefault();
    if (this.isLocked) return;
    const key = this.cellKey(col, row);
    if (this.activeDeckMap.has(key)) {
      this.activeDeckMap.delete(key);
      this.isDirty = true;
      this.recalcNextSeatNo();
      this.cdr.markForCheck();
    }
  }

  /* ═══════ Seat rename ═══════ */

  startSeatEdit(key: string, currentValue: string): void {
    this.editingSeatKey = key;
    this.editingSeatValue = currentValue;
    this.cdr.markForCheck();
  }

  confirmSeatEdit(): void {
    if (!this.editingSeatKey) return;
    const newVal = this.editingSeatValue.trim();
    const el = this.activeDeckMap.get(this.editingSeatKey);
    if (!el) {
      this.cancelSeatEdit();
      return;
    }

    if (!newVal) {
      this.cancelSeatEdit();
      return;
    }

    // Check uniqueness across both decks
    const isDuplicate = this.isSeatNoDuplicate(newVal, this.editingSeatKey);
    if (isDuplicate) {
      this.alert.warning(
        this.translate.instant('BUSES.LAYOUT.DUPLICATE_SEAT', {
          seatNo: newVal,
        }),
      );
      this.cancelSeatEdit();
      return;
    }

    el.seatNo = newVal;
    this.activeDeckMap.set(this.editingSeatKey, el);
    this.isDirty = true;
    this.editingSeatKey = null;
    this.editingSeatValue = '';
    this.cdr.markForCheck();
  }

  cancelSeatEdit(): void {
    this.editingSeatKey = null;
    this.editingSeatValue = '';
    this.cdr.markForCheck();
  }

  onSeatEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.confirmSeatEdit();
    } else if (event.key === 'Escape') {
      this.cancelSeatEdit();
    }
  }

  isEditing(col: number, row: number): boolean {
    return this.editingSeatKey === this.cellKey(col, row);
  }

  private isSeatNoDuplicate(seatNo: string, excludeKey: string): boolean {
    for (const [k, el] of this.lowerDeck) {
      if (k !== excludeKey && el.seatNo === seatNo) return true;
    }
    for (const [k, el] of this.upperDeck) {
      if (k !== excludeKey && el.seatNo === seatNo) return true;
    }
    return false;
  }

  /* ═══════ Deck toggle ═══════ */

  switchDeck(deck: DeckSide): void {
    if (deck === 'upper' && !this.hasDecks) return;
    this.activeDeck = deck;
    this.editingSeatKey = null;
    this.cdr.markForCheck();
  }

  async toggleHasDecks(): Promise<void> {
    if (this.isLocked) return;

    if (this.hasDecks && this.upperDeck.size > 0) {
      const result = await this.alert.confirm(
        this.translate.instant('BUSES.LAYOUT.RESET_CONFIRM'),
      );
      if (!result.isConfirmed) {
        // revert the checkbox
        this.hasDecks = true;
        this.cdr.markForCheck();
        return;
      }
      this.upperDeck.clear();
    }

    this.hasDecks = !this.hasDecks;
    if (!this.hasDecks) {
      this.activeDeck = 'lower';
    }
    this.isDirty = true;
    this.recalcNextSeatNo();
    this.cdr.markForCheck();
  }

  /* ═══════ Grid resize ═══════ */

  async onGridColumnsChange(newVal: number): Promise<void> {
    if (this.isLocked) return;
    newVal = Math.max(3, Math.min(7, newVal));
    const outOfBounds = this.countOutOfBounds(newVal, this.gridRows);
    if (outOfBounds > 0) {
      const result = await this.alert.confirm(
        this.translate.instant('BUSES.LAYOUT.CONFIRM_RESIZE', {
          count: outOfBounds,
        }),
      );
      if (!result.isConfirmed) {
        // revert
        this.gridColumns = this.gridColumns;
        this.cdr.markForCheck();
        return;
      }
      this.removeOutOfBounds(newVal, this.gridRows);
    }
    this.gridColumns = newVal;
    this.isDirty = true;
    this.recalcNextSeatNo();
    this.cdr.markForCheck();
  }

  async onGridRowsChange(newVal: number): Promise<void> {
    if (this.isLocked) return;
    newVal = Math.max(5, Math.min(20, newVal));
    const outOfBounds = this.countOutOfBounds(this.gridColumns, newVal);
    if (outOfBounds > 0) {
      const result = await this.alert.confirm(
        this.translate.instant('BUSES.LAYOUT.CONFIRM_RESIZE', {
          count: outOfBounds,
        }),
      );
      if (!result.isConfirmed) {
        this.gridRows = this.gridRows;
        this.cdr.markForCheck();
        return;
      }
      this.removeOutOfBounds(this.gridColumns, newVal);
    }
    this.gridRows = newVal;
    this.isDirty = true;
    this.recalcNextSeatNo();
    this.cdr.markForCheck();
  }

  private countOutOfBounds(maxCols: number, maxRows: number): number {
    let count = 0;
    const check = (deck: Map<string, LayoutElement>) => {
      deck.forEach((el) => {
        if (el.gridX > maxCols || el.gridY > maxRows) count++;
      });
    };
    check(this.lowerDeck);
    if (this.hasDecks) check(this.upperDeck);
    return count;
  }

  private removeOutOfBounds(maxCols: number, maxRows: number): void {
    const clean = (deck: Map<string, LayoutElement>) => {
      for (const [key, el] of deck) {
        if (el.gridX > maxCols || el.gridY > maxRows) {
          deck.delete(key);
        }
      }
    };
    clean(this.lowerDeck);
    if (this.hasDecks) clean(this.upperDeck);
  }

  /* ═══════ Reset to default ═══════ */

  async resetToDefault(): Promise<void> {
    if (this.isLocked) return;
    const result = await this.alert.confirm(
      this.translate.instant('BUSES.LAYOUT.RESET_CONFIRM'),
    );
    if (!result.isConfirmed) return;
    this.loadFromTemplate(buildDefaultTunisianLayout());
    this.isDirty = true;
    this.recalcNextSeatNo();
    this.cdr.markForCheck();
  }

  /* ═══════ Save flow ═══════ */

  save(): void {
    if (this.isLocked || this.isSaving || !this.bus?.id) return;
    this.isSaving = true;

    const layout = this.serializeLayout();
    const totalSeats = this.seatCount;

    this.busService
      .update(this.bus?.id, { layoutTemplate: layout, totalSeats } as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant('BUSES.LAYOUT.SAVE_SUCCESS'),
          );
          this.isDirty = false;
          this.isSaving = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const msg: string = err?.error?.message || '';
          if (msg.includes('LAYOUT_LOCKED')) {
            this.alert.error(this.translate.instant('BUSES.LAYOUT.LOCKED'));
          } else {
            this.alert.error(this.translate.instant('BUSES.LAYOUT.SAVE_ERROR'));
          }
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  /* ═══════ Serialization ═══════ */

  private serializeLayout(): LayoutTemplate {
    return {
      gridColumns: this.gridColumns,
      gridRows: this.gridRows,
      hasDecks: this.hasDecks,
      lowerDeck: Array.from(this.lowerDeck.values()),
      upperDeck: this.hasDecks ? Array.from(this.upperDeck.values()) : [],
    };
  }

  /* ═══════ Load from template ═══════ */

  private loadFromTemplate(tpl: LayoutTemplate): void {
    this.gridColumns = tpl.gridColumns;
    this.gridRows = tpl.gridRows;
    this.hasDecks = tpl.hasDecks;
    this.lowerDeck.clear();
    this.upperDeck.clear();

    for (const el of tpl.lowerDeck) {
      this.lowerDeck.set(this.cellKey(el.gridX, el.gridY), el);
    }
    for (const el of tpl.upperDeck || []) {
      this.upperDeck.set(this.cellKey(el.gridX, el.gridY), el);
    }

    this.activeDeck = 'lower';
  }

  /* ═══════ Auto-numbering ═══════ */

  private recalcNextSeatNo(): void {
    let max = 0;
    const scan = (deck: Map<string, LayoutElement>) => {
      deck.forEach((el) => {
        if (el.type === LayoutElementType.SEAT && el.seatNo) {
          const n = parseInt(el.seatNo, 10);
          if (!isNaN(n) && n > max) max = n;
        }
      });
    };
    scan(this.lowerDeck);
    scan(this.upperDeck);
    this.nextSeatNo = max + 1;
  }

  /* ═══════ Element icon helpers for template ═══════ */

  elementIcon(type: LayoutElementType): string {
    switch (type) {
      case LayoutElementType.DRIVER:
        return 'ki-duotone ki-car';
      case LayoutElementType.DOOR:
        return 'ki-duotone ki-entrance-left';
      case LayoutElementType.STAIRS:
        return 'ki-duotone ki-arrow-up';
      case LayoutElementType.TOILET:
        return 'ki-duotone ki-drop';
      default:
        return '';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/* ═══════ Default Tunisian layout ═══════ */

export function buildDefaultTunisianLayout(): LayoutTemplate {
  const elements: LayoutElement[] = [];

  // Row 1: DRIVER(1,1), DOOR(5,1)
  elements.push({
    type: LayoutElementType.DRIVER,
    seatNo: null,
    gridX: 1,
    gridY: 1,
  });
  elements.push({
    type: LayoutElementType.DOOR,
    seatNo: null,
    gridX: 5,
    gridY: 1,
  });

  let seatNo = 1;

  // Rows 2–6: seats at cols 1, 2, 4, 5  (col 3 = aisle)
  for (let row = 2; row <= 6; row++) {
    for (const col of [1, 2, 4, 5]) {
      elements.push({
        type: LayoutElementType.SEAT,
        seatNo: String(seatNo++),
        gridX: col,
        gridY: row,
      });
    }
  }

  // Row 7: seats at 1, 2 + DOOR at 5
  elements.push({
    type: LayoutElementType.SEAT,
    seatNo: String(seatNo++),
    gridX: 1,
    gridY: 7,
  });
  elements.push({
    type: LayoutElementType.SEAT,
    seatNo: String(seatNo++),
    gridX: 2,
    gridY: 7,
  });
  elements.push({
    type: LayoutElementType.DOOR,
    seatNo: null,
    gridX: 5,
    gridY: 7,
  });

  // Rows 8–13: seats at cols 1, 2, 4, 5
  for (let row = 8; row <= 13; row++) {
    for (const col of [1, 2, 4, 5]) {
      elements.push({
        type: LayoutElementType.SEAT,
        seatNo: String(seatNo++),
        gridX: col,
        gridY: row,
      });
    }
  }

  // Row 14: back bench – all 5 columns
  for (let col = 1; col <= 5; col++) {
    elements.push({
      type: LayoutElementType.SEAT,
      seatNo: String(seatNo++),
      gridX: col,
      gridY: 14,
    });
  }

  return {
    gridColumns: 5,
    gridRows: 14,
    hasDecks: false,
    lowerDeck: elements,
    upperDeck: [],
  };
}
