import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MovieService } from '../movie.service';

const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-movie-search',
  templateUrl: './movie-search.html',
})
export class MovieSearch {
  private readonly movieService = inject(MovieService);

  protected readonly draft = signal(this.movieService.querySignal());

  private pending: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.pending));
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(value);
    clearTimeout(this.pending);
    if (value.trim() === '') {
      this.movieService.setQuery('');
    } else {
      this.pending = setTimeout(() => this.movieService.setQuery(this.draft()), DEBOUNCE_MS);
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    clearTimeout(this.pending);
    this.movieService.setQuery(this.draft());
  }

  protected clear(input: HTMLInputElement): void {
    this.draft.set('');
    clearTimeout(this.pending);
    this.movieService.setQuery('');
    input.focus();
  }
}
