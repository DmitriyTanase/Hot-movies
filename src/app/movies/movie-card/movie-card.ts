import { Component, computed, input } from '@angular/core';
import { Movie } from '../movie';
import { posterUrl } from '../tmdb';

@Component({
  selector: 'app-movie-card',
  templateUrl: './movie-card.html',
})
export class MovieCard {
  readonly movie = input.required<Movie>();

  protected readonly poster = computed(() => posterUrl(this.movie().poster_path, 'w342'));
}
