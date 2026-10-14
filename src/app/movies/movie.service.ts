import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { errorMessage } from './error-message';
import { Movie, MovieDetails, TmdbPage } from './movie';
import { TMDB_API_URL } from './tmdb';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    Authorization: `Bearer ${environment.tmdbAccessToken}`,
  });

  // undefined = list not requested yet -> resource idle -> no HTTP
  private readonly query = signal<string | undefined>(undefined);

  private readonly list = rxResource({
    params: () => this.query(),
    stream: ({ params: q }) => (q ? this.searchMovies(q) : this.getPopularMovies()),
  });

  readonly querySignal = computed(() => this.query() ?? '');
  readonly moviesSignal = computed(() => (this.list.hasValue() ? this.list.value() : []));
  readonly loadingSignal = this.list.isLoading;
  readonly errorSignal = computed(() => {
    const err = this.list.error();
    return err ? errorMessage(err) : null;
  });

  getPopularMovies(): Observable<Movie[]> {
    const params = new HttpParams().set('language', 'en-US').set('page', 1);
    return this.http
      .get<TmdbPage<Movie>>(`${TMDB_API_URL}/movie/popular`, { headers: this.headers, params })
      .pipe(map((r) => r.results));
  }

  searchMovies(keyword: string): Observable<Movie[]> {
    const params = new HttpParams()
      .set('query', keyword)
      .set('include_adult', false)
      .set('language', 'en-US')
      .set('page', 1);
    return this.http
      .get<TmdbPage<Movie>>(`${TMDB_API_URL}/search/movie`, { headers: this.headers, params })
      .pipe(map((r) => r.results));
  }

  getMovieDetails(id: number): Observable<MovieDetails> {
    const params = new HttpParams().set('language', 'en-US');
    return this.http.get<MovieDetails>(`${TMDB_API_URL}/movie/${id}`, {
      headers: this.headers,
      params,
    });
  }

  loadList(): void {
    if (this.query() === undefined) {
      this.query.set('');
    }
  }

  setQuery(keyword: string): void {
    this.query.set(keyword.trim());
  }

  reloadList(): void {
    this.list.reload();
  }
}
