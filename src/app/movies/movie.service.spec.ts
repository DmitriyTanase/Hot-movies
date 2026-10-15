import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Movie, MovieDetails, TmdbPage } from './movie';
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

function page(results: Movie[], total_pages = 1, pageNumber = 1): TmdbPage<Movie> {
  return { page: pageNumber, results, total_pages, total_results: results.length };
}

describe('MovieService', () => {
  let service: MovieService;
  let httpMock: HttpTestingController;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const popular = () => httpMock.expectOne((r) => r.url === `${API}/movie/popular`);
  const search = (query: string, pageNumber = 1) =>
    httpMock.expectOne(
      (r) =>
        r.url === `${API}/search/movie` &&
        r.params.get('query') === query &&
        r.params.get('page') === String(pageNumber),
    );
  const popularPage = (pageNumber: number) =>
    httpMock.expectOne(
      (r) => r.url === `${API}/movie/popular` && r.params.get('page') === String(pageNumber),
    );

  /** Loads popular page 1 with the given total, then page `target` (flushed). */
  const loadPopularAt = async (target: number, total = 10) => {
    service.loadList();
    TestBed.tick();
    popular().flush(page([movie(1, 'A')], total));
    await settle();
    if (target !== 1) {
      expect(service.goToPage(target)).toBe(true);
      TestBed.tick();
      popularPage(target).flush(page([movie(target, 'P')], total, target));
      await settle();
    }
  };
  const loadSearchAt = async (q: string, target: number, total = 10) => {
    service.setQuery(q);
    TestBed.tick();
    search(q).flush(page([movie(1, 'S')], total));
    await settle();
    expect(service.goToPage(target)).toBe(true);
    TestBed.tick();
    search(q, target).flush(page([movie(target, 'SP')], total, target));
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MovieService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('HTTP methods', () => {
    it('getPopularMovies requests popular movies and returns the full page', () => {
      let result: TmdbPage<Movie> | undefined;
      service.getPopularMovies().subscribe((r) => (result = r));

      const req = popular();
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('language')).toBe('en-US');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([movie(1, 'A')], 7));

      expect(result).toEqual(page([movie(1, 'A')], 7));
    });

    it('sends the requested page for popular and search', () => {
      service.getPopularMovies(3).subscribe();
      service.searchMovies('x', 4).subscribe();

      expect(popularPage(3).request.method).toBe('GET');
      expect(search('x', 4).request.params.get('include_adult')).toBe('false');
    });

    it('searchMovies requests a search and returns the full page', () => {
      let result: TmdbPage<Movie> | undefined;
      service.searchMovies('star wars').subscribe((r) => (result = r));

      const req = search('star wars');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('include_adult')).toBe('false');
      expect(req.request.params.get('language')).toBe('en-US');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([movie(2, 'B')], 4));

      expect(result).toEqual(page([movie(2, 'B')], 4));
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

  describe('paging', () => {
    it('loadList sends popular page 1 and exposes the totals', async () => {
      expect(service.pageSignal()).toBe(1);
      expect(service.totalPagesSignal()).toBe(0);

      await loadPopularAt(1, 5);

      expect(service.pageSignal()).toBe(1);
      expect(service.totalPagesSignal()).toBe(5);
    });

    it('a second loadList (Back) sends nothing and keeps page and results', async () => {
      await loadPopularAt(3);

      service.loadList();
      TestBed.tick();

      httpMock.expectNone(() => true);
      expect(service.pageSignal()).toBe(3);
      expect(service.moviesSignal()).toEqual([movie(3, 'P')]);
    });

    it('goToPage(3) sends page 3 of popular and replaces the results', async () => {
      await loadPopularAt(3);

      expect(service.pageSignal()).toBe(3);
      expect(service.moviesSignal()).toEqual([movie(3, 'P')]);
    });

    it('goToPage keeps the search mode', async () => {
      await loadSearchAt('bat', 2);

      expect(service.querySignal()).toBe('bat');
      expect(service.pageSignal()).toBe(2);
    });

    it('a new query resets to page 1', async () => {
      await loadPopularAt(3);

      service.setQuery('bat');
      TestBed.tick();

      search('bat', 1).flush(page([], 2));
      await settle();
      expect(service.pageSignal()).toBe(1);
    });

    it('Clear from search page 3 gives popular page 1', async () => {
      await loadSearchAt('bat', 3);

      service.setQuery('');
      TestBed.tick();

      popularPage(1).flush(page([movie(1, 'A')]));
      await settle();
      expect(service.pageSignal()).toBe(1);
      expect(service.querySignal()).toBe('');
    });

    it('Clear from popular page 3 (uncommitted draft) gives popular page 1', async () => {
      await loadPopularAt(3);

      service.setQuery('   ');
      TestBed.tick();

      popularPage(1).flush(page([movie(1, 'A')]));
      await settle();
      expect(service.pageSignal()).toBe(1);
    });

    it('Clear when already on popular page 1 sends nothing', async () => {
      await loadPopularAt(1);

      service.setQuery('');
      TestBed.tick();

      httpMock.expectNone(() => true);
    });

    it.each(['bat', ' bat '])(
      're-submitting the same query %j on page 3 sends nothing and keeps page 3',
      async (again) => {
        await loadSearchAt('bat', 3);

        service.setQuery(again);
        TestBed.tick();

        httpMock.expectNone(() => true);
        expect(service.pageSignal()).toBe(3);
        expect(service.moviesSignal()).toEqual([movie(3, 'SP')]);
      },
    );

    it.each([0, -1, 2.5, NaN, 11, 1])('goToPage(%s) is rejected and sends nothing', async (n) => {
      await loadPopularAt(1, 10);

      expect(service.goToPage(n)).toBe(false);
      TestBed.tick();

      httpMock.expectNone(() => true);
      expect(service.pageSignal()).toBe(1);
    });

    it('goToPage before loadList is rejected', () => {
      expect(service.goToPage(2)).toBe(false);
      TestBed.tick();

      httpMock.expectNone(() => true);
    });

    it('goToPage while loading is rejected', async () => {
      await loadPopularAt(1, 10);
      expect(service.goToPage(2)).toBe(true);
      TestBed.tick();
      const pending = popularPage(2);

      expect(service.goToPage(3)).toBe(false);
      TestBed.tick();

      httpMock.expectNone(() => true);
      pending.flush(page([], 10, 2));
      await settle();
    });

    it('goToPage on error is rejected', async () => {
      await loadPopularAt(1, 10);
      expect(service.goToPage(2)).toBe(true);
      TestBed.tick();
      popularPage(2).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(service.goToPage(3)).toBe(false);
      TestBed.tick();

      httpMock.expectNone(() => true);
    });

    it('caps total_pages at 500 and never requests page 501', async () => {
      await loadPopularAt(1, 38029);

      expect(service.totalPagesSignal()).toBe(500);
      expect(service.goToPage(501)).toBe(false);
      TestBed.tick();
      httpMock.expectNone(() => true);

      expect(service.goToPage(500)).toBe(true);
      TestBed.tick();
      popularPage(500).flush(page([], 38029, 500));
      await settle();
    });

    it('keeps totalPagesSignal during a same-query page load', async () => {
      await loadPopularAt(1, 10);

      expect(service.goToPage(2)).toBe(true);
      TestBed.tick();
      const pending = popularPage(2);

      expect(service.loadingSignal()).toBe(true);
      expect(service.totalPagesSignal()).toBe(10);

      pending.flush(page([], 10, 2));
      await settle();
      expect(service.totalPagesSignal()).toBe(10);
    });

    it('totalPagesSignal is 0 after a query change until the new response arrives', async () => {
      await loadPopularAt(1, 10);

      service.setQuery('bat');
      TestBed.tick();
      const pending = search('bat');

      expect(service.totalPagesSignal()).toBe(0);
      pending.flush(page([], 3));
      await settle();
      expect(service.totalPagesSignal()).toBe(3);
    });

    it('totalPagesSignal is 0 on error and returns after Retry succeeds', async () => {
      await loadPopularAt(1, 10);
      expect(service.goToPage(2)).toBe(true);
      TestBed.tick();
      popularPage(2).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(service.totalPagesSignal()).toBe(0);

      service.reloadList();
      TestBed.tick();
      const retry = popularPage(2);
      expect(service.totalPagesSignal()).toBe(0);

      retry.flush(page([movie(2, 'P')], 10, 2));
      await settle();
      expect(service.totalPagesSignal()).toBe(10);
      expect(service.pageSignal()).toBe(2);
    });

    it('a query change during a pending page request cancels it', async () => {
      await loadPopularAt(1, 10);
      expect(service.goToPage(2)).toBe(true);
      TestBed.tick();
      const pending = popularPage(2);

      service.setQuery('bat');
      TestBed.tick();

      expect(pending.cancelled).toBe(true);
      search('bat').flush(page([movie(3, 'Batman')]));
      await settle();
      expect(service.moviesSignal()).toEqual([movie(3, 'Batman')]);
    });

    it('reloadList re-requests the same page', async () => {
      await loadPopularAt(3);

      service.reloadList();
      TestBed.tick();

      popularPage(3).flush(page([movie(3, 'P')], 10, 3));
      await settle();
      expect(service.pageSignal()).toBe(3);
    });
  });
});
