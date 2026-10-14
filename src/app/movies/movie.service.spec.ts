import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Movie, MovieDetails } from './movie';
import { MovieService } from './movie.service';

const API = 'https://api.themoviedb.org/3';
const GENERIC = 'Something went wrong loading movies. Please try again.';
const TOKEN_MESSAGE = 'TMDb access token is missing or invalid. See README → Setup.';

function movie(id: number, title: string): Movie {
  return {
    id,
    title,
    overview: '',
    poster_path: null,
    release_date: '',
    vote_average: 0,
    vote_count: 0,
  };
}

function page(results: Movie[]) {
  return { page: 1, results, total_pages: 1, total_results: results.length };
}

describe('MovieService', () => {
  let service: MovieService;
  let httpMock: HttpTestingController;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const popular = () => httpMock.expectOne((r) => r.url === `${API}/movie/popular`);
  const search = (query: string) =>
    httpMock.expectOne((r) => r.url === `${API}/search/movie` && r.params.get('query') === query);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MovieService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('HTTP methods', () => {
    it('getPopularMovies requests popular movies and returns results', () => {
      let result: Movie[] | undefined;
      service.getPopularMovies().subscribe((r) => (result = r));

      const req = popular();
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('language')).toBe('en-US');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([movie(1, 'A')]));

      expect(result).toEqual([movie(1, 'A')]);
    });

    it('searchMovies requests a search and returns results', () => {
      let result: Movie[] | undefined;
      service.searchMovies('star wars').subscribe((r) => (result = r));

      const req = search('star wars');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('include_adult')).toBe('false');
      expect(req.request.params.get('language')).toBe('en-US');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([movie(2, 'B')]));

      expect(result).toEqual([movie(2, 'B')]);
    });

    it('getMovieDetails requests the movie and returns the body', () => {
      const details: MovieDetails = { ...movie(42, 'C'), genres: [{ id: 1, name: 'Drama' }] };
      let result: MovieDetails | undefined;
      service.getMovieDetails(42).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url === `${API}/movie/42`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('language')).toBe('en-US');
      req.flush(details);

      expect(result).toEqual(details);
    });

    it('sends the Authorization header built from the environment on all methods', () => {
      const expected = `Bearer ${environment.tmdbAccessToken}`;
      service.getPopularMovies().subscribe();
      service.searchMovies('x').subscribe();
      service.getMovieDetails(1).subscribe();

      const requests = httpMock.match(() => true);
      expect(requests.length).toBe(3);
      for (const req of requests) {
        expect(req.request.headers.get('Authorization')).toBe(expected);
        req.flush(page([]));
      }
    });

    it('still sends the request with an empty token and maps 401 to the token message', async () => {
      service.loadList();
      TestBed.tick();

      const req = popular();
      expect(req.request.headers.get('Authorization')).toBe('Bearer ');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      await settle();

      expect(service.errorSignal()).toBe(TOKEN_MESSAGE);
    });
  });

  describe('list state', () => {
    it('is idle after construction and sends no request', () => {
      TestBed.tick();

      httpMock.expectNone(() => true);
      expect(service.moviesSignal()).toEqual([]);
      expect(service.loadingSignal()).toBe(false);
      expect(service.errorSignal()).toBeNull();
      expect(service.querySignal()).toBe('');
    });

    it('loadList loads popular movies once', async () => {
      service.loadList();
      TestBed.tick();

      const req = popular();
      expect(service.loadingSignal()).toBe(true);
      req.flush(page([movie(1, 'A')]));
      await settle();

      expect(service.moviesSignal()).toEqual([movie(1, 'A')]);
      expect(service.loadingSignal()).toBe(false);
    });

    it('a second loadList sends no request and keeps the current query', async () => {
      service.loadList();
      TestBed.tick();
      popular().flush(page([]));
      await settle();

      service.setQuery('bat');
      TestBed.tick();
      search('bat').flush(page([movie(3, 'Batman')]));
      await settle();

      service.loadList();
      TestBed.tick();

      httpMock.expectNone(() => true);
      expect(service.querySignal()).toBe('bat');
      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });

    it('setQuery searches and exposes the search results', async () => {
      service.setQuery('bat');
      TestBed.tick();

      const req = search('bat');
      expect(service.querySignal()).toBe('bat');
      req.flush(page([movie(3, 'Batman')]));
      await settle();

      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });

    it.each(['   ', ''])('setQuery(%j) after a search returns to popular', async (blank) => {
      service.setQuery('bat');
      TestBed.tick();
      search('bat').flush(page([]));
      await settle();

      service.setQuery(blank);
      TestBed.tick();

      popular().flush(page([movie(1, 'A')]));
      await settle();
      expect(service.querySignal()).toBe('');
      expect(service.moviesSignal()).toEqual([movie(1, 'A')]);
    });

    it('sends one request for equivalent queries', () => {
      service.setQuery('bat');
      TestBed.tick();
      service.setQuery('bat ');
      TestBed.tick();

      search('bat').flush(page([]));
    });

    it('cancels the pending request when the query changes and shows only the latest results', async () => {
      service.setQuery('bat');
      TestBed.tick();
      const first = search('bat');

      service.setQuery('batman');
      TestBed.tick();
      const second = search('batman');

      expect(first.cancelled).toBe(true);
      second.flush(page([movie(3, 'Batman')]));
      await settle();

      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });

    it('exposes a failed request as an error without throwing, and a new query clears it', async () => {
      service.loadList();
      TestBed.tick();
      popular().flush({}, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(service.errorSignal()).toBe(GENERIC);
      expect(service.loadingSignal()).toBe(false);
      expect(service.moviesSignal()).toEqual([]);

      service.setQuery('bat');
      TestBed.tick();
      expect(service.errorSignal()).toBeNull();
      search('bat').flush(page([movie(3, 'Batman')]));
      await settle();
      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });

    it('reloadList resends the same query after an error', async () => {
      service.setQuery('bat');
      TestBed.tick();
      search('bat').flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(service.errorSignal()).toBe(GENERIC);

      service.reloadList();
      TestBed.tick();
      search('bat').flush(page([movie(3, 'Batman')]));
      await settle();

      expect(service.errorSignal()).toBeNull();
      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });
  });
});
