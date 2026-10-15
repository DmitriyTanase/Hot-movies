import { Component, computed, input, output } from '@angular/core';
import { pageWindow } from './page-window';

@Component({
  selector: 'app-movie-pagination',
  templateUrl: './movie-pagination.html',
})
export class MoviePagination {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly disabled = input(false);
  readonly pageChange = output<number>();

  protected readonly items = computed(() => pageWindow(this.currentPage(), this.totalPages()));

  protected select(page: number): void {
    if (
      Number.isInteger(page) &&
      page >= 1 &&
      page <= this.totalPages() &&
      page !== this.currentPage()
    ) {
      this.pageChange.emit(page);
    }
  }
}
