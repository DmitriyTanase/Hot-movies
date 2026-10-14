import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { MovieDetails } from '../movie';
import { MovieDetail } from './movie-detail';
import { MovieList } from '../movie-list/movie-list';

const API = 'https://api.themoviedb.org/3';

function details(overrides: Partial<MovieDetails> = {}): MovieDetails {
  return {
    id: 42,
    title: 'Heat',
    overview: 'A heist movie.',
    poster_path: '/heat.jpg',
    release_date: '1995-12-15',
    vote_average: 7.5,
    vote_count: 100,
    genres: [
      { id: 1, name: 'Crime' },
      { id: 2, name: 'Drama' },
    ],
    ...overrides,
  };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('MovieDetail', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    await harness.fixture.whenStable();
  };
  const detailReq = (id = 42) => httpMock.expectOne((r) => r.url === `${API}/movie/${id}`);

  // Navigation is not awaited: whenStable never resolves while a request is pending.
  const open = async (url: string) => {
    harness = await RouterTestingHarness.create();
    void harness.navigateByUrl(url);
    // the route component is lazy-loaded: wait until it is activated
    for (let i = 0; i < 100 && !harness.routeNativeElement; i++) {
      await tick();
    }
    harness.fixture.detectChanges();
    await tick();
    el = harness.routeNativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('deep link sends exactly one details request and no popular request', async () => {
    await open('/movie/42');
    const req = detailReq();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('en-US');
    httpMock.expectNone((r) => r.url === `${API}/movie/popular`);
    req.flush(details());
    await settle();
  });

  it('shows the skeleton while loading', async () => {
    await open('/movie/42');
    harness.fixture.detectChanges();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
    expect(el.textContent).toContain('Back to movies');
    detailReq().flush(details());
    await settle();
  });

  it('renders all fields on success', async () => {
    await open('/movie/42');
    detailReq().flush(details());
    await settle();
    expect(el.querySelector('h2')?.textContent).toContain('Heat');
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w500/heat.jpg');
    expect(img?.getAttribute('alt')).toBe('Heat');
    expect(el.textContent).toContain('A heist movie.');
    expect(el.textContent).toContain('Crime');
    expect(el.textContent).toContain('Drama');
    expect(el.textContent).toContain('7.5 / 10');
    expect(el.textContent).toContain('Dec 15, 1995');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
    expect(el.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('renders fallbacks for missing data', async () => {
    await open('/movie/42');
    detailReq().flush(
      details({
        poster_path: null,
        overview: '',
        genres: [],
        vote_count: 0,
        vote_average: 0,
        release_date: '',
      }),
    );
    await settle();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('No poster');
    expect(el.textContent).toContain('No description available.');
    expect(el.textContent).toContain('No genres listed.');
    expect(el.textContent).toContain('Not rated');
    expect(el.textContent).not.toContain('/ 10');
    expect(el.textContent).toContain('Unknown');
  });

  it('shows Movie not found with Retry and Back on 404', async () => {
    await open('/movie/42');
    detailReq().flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Movie not found.');
    expect(el.querySelector('button')?.textContent).toContain('Retry');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('shows the generic message on 500 and Retry succeeds', async () => {
    await open('/movie/42');
    detailReq().flush({}, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
    el.querySelector('button')?.click();
    await tick();
    detailReq().flush(details());
    await settle();
    expect(el.querySelector('h2')?.textContent).toContain('Heat');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(['abc', '0'])('shows Invalid movie id and sends no request for %s', async (id) => {
    await open(`/movie/${id}`);
    await settle();
    httpMock.expectNone(() => true);
    expect(el.textContent).toContain('Invalid movie id');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});

describe('routes', () => {
  it('movie/:id lazy-loads MovieDetail with the title', async () => {
    const route = routes.find((r) => r.path === 'movie/:id');
    expect(route?.title).toBe('Movie details');
    const loaded = await (route?.loadComponent as () => Promise<unknown>)();
    expect(loaded).toBe(MovieDetail);
  });

  it('the empty path loads MovieList and unknown paths redirect to it', async () => {
    const root = routes.find((r) => r.path === '');
    expect(root?.title).toBe('HOT Movies');
    expect(await (root?.loadComponent as () => Promise<unknown>)()).toBe(MovieList);
    expect(routes.find((r) => r.path === '**')?.redirectTo).toBe('');
  });
});
