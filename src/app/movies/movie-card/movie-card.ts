import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../movie';
import { posterUrl } from '../tmdb';

@Component({
  selector: 'app-movie-card',
  imports: [RouterLink],
  templateUrl: './movie-card.html',
})
export class MovieCard {
  readonly movie = input.required<Movie>();

  protected readonly titleId = computed(() => `movie-title-${this.movie().id}`);
  protected readonly poster = computed(() => posterUrl(this.movie().poster_path, 'w342'));
}
