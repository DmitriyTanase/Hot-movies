import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './error-message';

const GENERIC = 'Something went wrong loading movies. Please try again.';

describe('errorMessage', () => {
  it('maps 401 to the token message', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 401 }))).toBe(
      'TMDb access token is missing or invalid. See README → Setup.',
    );
  });

  it('maps 404 to not found', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 404 }))).toBe('Movie not found.');
  });

  it('maps status 0 to a network error', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toBe(
      'Network error. Check your connection.',
    );
  });

  it('maps any other status to the generic message', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500 }))).toBe(GENERIC);
  });

  it('maps a non-HTTP error to the generic message', () => {
    expect(errorMessage(new Error('boom'))).toBe(GENERIC);
    expect(errorMessage('boom')).toBe(GENERIC);
  });

  it('unwraps an HttpErrorResponse wrapped in cause', () => {
    const wrapped = new Error('wrapped', { cause: new HttpErrorResponse({ status: 401 }) });
    expect(errorMessage(wrapped)).toBe(
      'TMDb access token is missing or invalid. See README → Setup.',
    );
  });
});
