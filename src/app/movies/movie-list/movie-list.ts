import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { MovieCard } from '../movie-card/movie-card';
import { MoviePagination } from '../movie-pagination/movie-pagination';
import { MovieSearch } from '../movie-search/movie-search';
import { MovieService } from '../movie.service';

@Component({
  selector: 'app-movie-list',
  imports: [MovieSearch, MovieCard, MoviePagination],
  templateUrl: './movie-list.html',
})
export class MovieList {
  private readonly movieService = inject(MovieService);

  protected readonly movies = this.movieService.moviesSignal;
  protected readonly loading = this.movieService.loadingSignal;
  protected readonly error = this.movieService.errorSignal;
  protected readonly query = this.movieService.querySignal;
  protected readonly page = this.movieService.pageSignal;
  protected readonly totalPages = this.movieService.totalPagesSignal;

  private readonly results = viewChild.required<ElementRef<HTMLElement>>('results');

  protected readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

  constructor() {
    this.movieService.loadList();
  }

  protected retry(): void {
    this.movieService.reloadList();
  }

  protected onPageChange(page: number): void {
    if (this.movieService.goToPage(page)) {
      this.results().nativeElement.focus();
    }
  }
}
