import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Movie } from '../movie';
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

function page(results: Movie[]) {
  return { page: 1, results, total_pages: 1, total_results: results.length };
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
});
