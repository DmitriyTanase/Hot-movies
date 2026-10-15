import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Movie, TmdbPage } from '../movie';
import { MovieService } from '../movie.service';
import { MovieList } from './movie-list';

const API = 'https://api.themoviedb.org/3';

function movie(id: number): Movie {
  return {
    id,
    title: `Movie ${id}`,
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

describe('MovieList', () => {
  let fixture: ComponentFixture<MovieList>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    await fixture.whenStable();
  };
  const popular = () => httpMock.expectOne((r) => r.url === `${API}/movie/popular`);
  const popularPage = (n: number) =>
    httpMock.expectOne(
      (r) => r.url === `${API}/movie/popular` && r.params.get('page') === String(n),
    );
  const pager = () => el.querySelector('app-movie-pagination nav');
  const next = () =>
    el.querySelector<HTMLButtonElement>('app-movie-pagination button[aria-label="Next page"]')!;

  const create = async () => {
    fixture = TestBed.createComponent(MovieList);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends no request until the component is created', async () => {
    TestBed.inject(MovieService);
    await TestBed.inject(ApplicationRef).whenStable();
    httpMock.expectNone(() => true);
  });

  it('sends one popular request and shows the skeleton while loading', async () => {
    await create();
    const req = popular();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    req.flush(page([movie(1)]));
    await settle();
  });

  it('renders one card per movie after loading', async () => {
    await create();
    popular().flush(page([movie(1), movie(2), movie(3)]));
    await settle();
    expect(el.querySelectorAll('app-movie-card article').length).toBe(3);
    expect(el.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the error on failure and Retry sends the request again', async () => {
    await create();
    popular().flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(el.textContent).toContain('Something went wrong loading movies. Please try again.');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
    expect(el.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('');

    const retry = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    )!;
    retry.click();
    fixture.detectChanges();
    popular().flush(page([movie(1)]));
    await settle();
    expect(el.querySelectorAll('app-movie-card').length).toBe(1);
    expect(el.textContent).not.toContain('Something went wrong');
  });

  it('shows "No movies available." for an empty popular result', async () => {
    await create();
    popular().flush(page([]));
    await settle();
    expect(el.textContent).toContain('No movies available.');
  });

  it('shows the query for an empty search result', async () => {
    await create();
    popular().flush(page([movie(1)]));
    await settle();

    TestBed.inject(MovieService).setQuery('x');
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${API}/search/movie` && r.params.get('query') === 'x')
      .flush(page([]));
    await settle();
    expect(el.textContent).toContain('No movies found for "x".');
  });

  describe('pagination', () => {
    it('shows no pager when total_pages is 1', async () => {
      await create();
      popular().flush(page([movie(1)], 1));
      await settle();
      expect(pager()).toBeNull();
      expect(el.querySelector('[aria-live="polite"]')?.textContent).not.toContain('Page 1 of');
    });

    it('shows the pager and the page in the status line when total_pages is 5', async () => {
      await create();
      popular().flush(page([movie(1)], 5));
      await settle();
      expect(pager()).not.toBeNull();
      expect(el.querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Page 1 of 5. 1 movies shown.',
      );
    });

    it('does not move focus on initial load or search', async () => {
      await create();
      popular().flush(page([movie(1)], 5));
      await settle();
      expect(document.activeElement).toBe(document.body);

      TestBed.inject(MovieService).setQuery('x');
      fixture.detectChanges();
      httpMock
        .expectOne((r) => r.url === `${API}/search/movie` && r.params.get('query') === 'x')
        .flush(page([movie(2)], 3));
      await settle();
      expect(document.activeElement).toBe(document.body);
    });

    it('Next requests page 2, keeps the pager disabled while loading and focuses the results', async () => {
      await create();
      popular().flush(page([movie(1)], 5));
      await settle();

      next().click();
      fixture.detectChanges();
      const req = popularPage(2);

      expect(document.activeElement).toBe(el.querySelector('[tabindex="-1"]'));
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(pager()).not.toBeNull();
      expect(
        Array.from(el.querySelectorAll('app-movie-pagination button')).every(
          (b) => (b as HTMLButtonElement).disabled,
        ),
      ).toBe(true);

      req.flush(page([movie(11)], 5, 2));
      await settle();
      expect(el.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Page 2');
      expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('Page 2 of 5.');
    });

    it('hides the pager on error and Retry keeps focus where it was', async () => {
      await create();
      popular().flush(page([movie(1)], 5));
      await settle();
      next().click();
      fixture.detectChanges();
      popularPage(2).flush('boom', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(pager()).toBeNull();

      (document.activeElement as HTMLElement).blur();
      Array.from(el.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Retry'))!
        .click();
      fixture.detectChanges();
      expect(pager()).toBeNull();
      expect(document.activeElement).toBe(document.body);
      popularPage(2).flush(page([movie(11)], 5, 2));
      await settle();
      expect(pager()).not.toBeNull();
    });
  });
});

describe('MovieList navigation', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));
  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    await harness.fixture.whenStable();
  };
  // Navigation is not awaited: whenStable never resolves while a request is pending.
  const go = async (url: string, selector: string) => {
    void harness.navigateByUrl(url);
    for (let i = 0; i < 100 && !harness.routeNativeElement?.querySelector(selector); i++) {
      await tick();
    }
    harness.fixture.detectChanges();
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

  it('page 3 -> details -> Back keeps page 3, its results and sends no list request', async () => {
    harness = await RouterTestingHarness.create();
    await go('/', 'app-movie-search');
    httpMock
      .expectOne((r) => r.url === `${API}/movie/popular` && r.params.get('page') === '1')
      .flush(page([movie(1)], 10));
    await settle();

    const list = harness.routeNativeElement as HTMLElement;
    list.querySelector<HTMLButtonElement>('button[aria-label="Page 3"]')?.click();
    harness.fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${API}/movie/popular` && r.params.get('page') === '3')
      .flush(page([movie(31), movie(32)], 10, 3));
    await settle();

    await go('/movie/31', 'app-movie-detail a');
    httpMock
      .expectOne((r) => r.url === `${API}/movie/31`)
      .flush({
        ...movie(31),
        genres: [],
      });
    await settle();

    harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a')?.click();
    for (
      let i = 0;
      i < 100 && !harness.routeNativeElement?.querySelector('app-movie-search');
      i++
    ) {
      await tick();
    }
    harness.fixture.detectChanges();
    await settle();

    httpMock.expectNone(() => true);
    const back = harness.routeNativeElement as HTMLElement;
    expect(back.querySelectorAll('app-movie-card').length).toBe(2);
    expect(back.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Page 3');
  });
});
