import { Component, inject } from '@angular/core';
import { MovieCard } from '../movie-card/movie-card';
import { MovieSearch } from '../movie-search/movie-search';
import { MovieService } from '../movie.service';

@Component({
  selector: 'app-movie-list',
  imports: [MovieSearch, MovieCard],
  templateUrl: './movie-list.html',
})
export class MovieList {
  private readonly movieService = inject(MovieService);

  protected readonly movies = this.movieService.moviesSignal;
  protected readonly loading = this.movieService.loadingSignal;
  protected readonly error = this.movieService.errorSignal;
  protected readonly query = this.movieService.querySignal;

  protected readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

  constructor() {
    this.movieService.loadList();
  }

  protected retry(): void {
    this.movieService.reloadList();
  }
}
