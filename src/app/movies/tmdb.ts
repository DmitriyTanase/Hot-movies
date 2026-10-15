export const TMDB_API_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/';

export function posterUrl(path: string | null, size: 'w342' | 'w500'): string | null {
  return path ? `${TMDB_IMAGE_URL}${size}${path}` : null;
}

// TMDb rejects pages above 500 (error code 22: "Pages start at 1 and max at 500").
export const TMDB_MAX_PAGE = 500;
