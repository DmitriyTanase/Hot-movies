import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../error-message';
import { MovieService } from '../movie.service';
import { posterUrl } from '../tmdb';

@Component({
  selector: 'app-movie-detail',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private readonly movieService = inject(MovieService);

  // Bound from the route by withComponentInputBinding()
  readonly id = input.required<string>();

  protected readonly validId = computed(() => {
    const raw = this.id();
    const parsed = /^\d+$/.test(raw) ? Number(raw) : 0;
    return parsed > 0 ? parsed : undefined;
  });

  // undefined params -> resource idle -> no HTTP
  protected readonly details = rxResource({
    params: () => this.validId(),
    stream: ({ params }) => this.movieService.getMovieDetails(params),
  });

  protected readonly poster = computed(() =>
    this.details.hasValue() ? posterUrl(this.details.value().poster_path, 'w500') : null,
  );

  protected readonly error = computed(() => {
    const err = this.details.error();
    return err ? errorMessage(err) : null;
  });

  protected retry(): void {
    this.details.reload();
  }
}
