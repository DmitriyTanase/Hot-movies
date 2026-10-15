import { HttpErrorResponse } from '@angular/common/http';

function findHttpError(err: unknown): HttpErrorResponse | null {
  if (err instanceof HttpErrorResponse) {
    return err;
  }
  if (err instanceof Error && err.cause !== undefined) {
    return findHttpError(err.cause);
  }
  return null;
}

export function errorMessage(err: unknown): string {
  switch (findHttpError(err)?.status) {
    case 401:
      return 'TMDb access token is missing or invalid. See README → Setup.';
    case 404:
      return 'Movie not found.';
    case 0:
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
