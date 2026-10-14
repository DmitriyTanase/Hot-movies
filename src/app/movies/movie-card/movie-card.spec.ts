import { TestBed } from '@angular/core/testing';
import { Movie } from '../movie';
import { MovieCard } from './movie-card';

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: 'Heat',
    overview: 'A heist movie.',
    poster_path: '/heat.jpg',
    release_date: '1995-12-15',
    vote_average: 8.2,
    vote_count: 100,
    ...overrides,
  };
}

describe('MovieCard', () => {
  const render = async (m: Movie) => {
    const fixture = TestBed.createComponent(MovieCard);
    fixture.componentRef.setInput('movie', m);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the poster with the w342 url and the title as alt', async () => {
    const el = await render(movie());
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/heat.jpg');
    expect(img?.getAttribute('alt')).toBe('Heat');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(el.querySelector('h2')?.textContent).toContain('Heat');
  });

  it('renders a placeholder when there is no poster', async () => {
    const el = await render(movie({ poster_path: null }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('No poster');
  });

  it('renders the overview', async () => {
    const el = await render(movie());
    expect(el.textContent).toContain('A heist movie.');
    expect(el.textContent).not.toContain('No description available.');
  });

  it('renders a fallback when the overview is empty', async () => {
    const el = await render(movie({ overview: '' }));
    expect(el.textContent).toContain('No description available.');
  });

  it('is a non-interactive article', async () => {
    const el = await render(movie());
    expect(el.querySelector('article')).not.toBeNull();
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('[href]')).toBeNull();
    expect(el.querySelector('[tabindex]')).toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('shows no rating or year', async () => {
    const el = await render(movie());
    expect(el.textContent).not.toContain('1995');
    expect(el.textContent).not.toContain('8.2');
  });
});
