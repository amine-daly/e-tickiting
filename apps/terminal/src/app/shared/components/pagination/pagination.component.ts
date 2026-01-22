import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() total = 0;

  @Output() pageChange = new EventEmitter<number>();

  get startIndex(): number {
    if (!this.total) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    if (!this.total) return 0;
    return Math.min(this.page * this.pageSize, this.total);
  }

  get totalPages(): number {
    return this.pageSize > 0
      ? Math.max(1, Math.ceil(this.total / this.pageSize))
      : 1;
  }

  get pages(): number[] {
    const totalPages = this.totalPages;
    const max = 6;
    if (totalPages <= max) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, this.page - 2);
    const end = Math.min(totalPages, start + max - 1);
    const adjustedStart = Math.max(1, end - max + 1);
    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, i) => adjustedStart + i,
    );
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.pageChange.emit(page);
  }
}
