import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { errorMessage } from './error-message';
import { Movie, MovieDetails, TmdbPage } from './movie';
import { TMDB_API_URL, TMDB_MAX_PAGE } from './tmdb';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    Authorization: `Bearer ${environment.tmdbAccessToken}`,
  });

  // undefined = list not requested yet -> resource idle -> no HTTP
  private readonly params = signal<{ query: string; page: number } | undefined>(undefined);

  private readonly list = rxResource({
    params: () => this.params(),
    stream: ({ params: { query, page } }) =>
      query ? this.searchMovies(query, page) : this.getPopularMovies(page),
  });

  readonly querySignal = computed(() => this.params()?.query ?? '');
  /** The requested page (not necessarily loaded yet). */
  readonly pageSignal = computed(() => this.params()?.page ?? 1);
  readonly moviesSignal = computed(() => (this.list.hasValue() ? this.list.value().results : []));
  readonly loadingSignal = this.list.isLoading;
  readonly errorSignal = computed(() => {
    const err = this.list.error();
    return err ? errorMessage(err) : null;
  });

  // Usable page count. Kept during a same-query page load; 0 on a new query, on error, or when idle.
  private readonly totalPages = linkedSignal<
    { query: string | undefined; total: number | undefined; failed: boolean },
    number
  >({
    source: () => ({
      query: this.params()?.query,
      total: this.list.hasValue() ? this.list.value().total_pages : undefined,
      failed: !!this.list.error(),
    }),
    computation: (src, prev) =>
      src.failed
        ? 0
        : src.total !== undefined
          ? Math.min(src.total, TMDB_MAX_PAGE)
          : prev && prev.source.query === src.query
            ? prev.value
            : 0,
  });
  readonly totalPagesSignal = this.totalPages.asReadonly();

  getPopularMovies(page = 1): Observable<TmdbPage<Movie>> {
    const params = new HttpParams().set('language', 'en-US').set('page', page);
    return this.http.get<TmdbPage<Movie>>(`${TMDB_API_URL}/movie/popular`, {
      headers: this.headers,
      params,
    });
  }

  searchMovies(keyword: string, page = 1): Observable<TmdbPage<Movie>> {
    const params = new HttpParams()
      .set('query', keyword)
      .set('include_adult', false)
      .set('language', 'en-US')
      .set('page', page);
    return this.http.get<TmdbPage<Movie>>(`${TMDB_API_URL}/search/movie`, {
      headers: this.headers,
      params,
    });
  }

  getMovieDetails(id: number): Observable<MovieDetails> {
    const params = new HttpParams().set('language', 'en-US');
    return this.http.get<MovieDetails>(`${TMDB_API_URL}/movie/${id}`, {
      headers: this.headers,
      params,
    });
  }

  loadList(): void {
    if (this.params() === undefined) {
      this.params.set({ query: '', page: 1 });
    }
  }

  setQuery(keyword: string): void {
    const query = keyword.trim();
    const current = this.params();
    if (query !== '' && query === current?.query) return; // same query keeps its page
    if (current?.query === query && current.page === 1) return; // already there
    this.params.set({ query, page: 1 });
  }

  /** Returns true when the page change was accepted. */
  goToPage(page: number): boolean {
    const current = this.params();
    if (
      !current ||
      this.loadingSignal() ||
      this.errorSignal() ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > this.totalPagesSignal() ||
      page === current.page
    ) {
      return false;
    }
    this.params.set({ ...current, page });
    return true;
  }

  reloadList(): void {
    this.list.reload();
  }
}
