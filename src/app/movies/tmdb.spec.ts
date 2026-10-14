import { posterUrl } from './tmdb';

describe('posterUrl', () => {
  it('builds the image URL for a path', () => {
    expect(posterUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });

  it('returns null for a null path', () => {
    expect(posterUrl(null, 'w500')).toBeNull();
  });
});
