export const TMDB_API_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/';

export function posterUrl(path: string | null, size: 'w342' | 'w500'): string | null {
  return path ? `${TMDB_IMAGE_URL}${size}${path}` : null;
}
