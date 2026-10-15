# HOT Movies

## Overview

HOT Movies is a movie discovery application built on the latest stable Angular and the
[TMDb API](https://developer.themoviedb.org/). It lists popular movies, searches the TMDb catalogue
as you type, and shows the details of each movie. It was written as a take-home assignment.

## Features

- **Popular movies:** a responsive grid of cards with poster, title and overview.
- **Live search:** results update 300 ms after you stop typing. The Search button or Enter searches
  immediately. Clearing the field, or entering only whitespace, restores the popular list.
- **Movie details:** title, poster, overview, genres, rating and release date, with a "Back to
  movies" link. Returning keeps the previous search, page and results without refetching.
- **Responsive UI:** a 2–5 column grid. The details page is stacked on mobile and side by side
  from tablet width.
- **Loading, error and empty states:**
  - skeleton placeholders while loading;
  - error messages with Retry;
  - distinct empty-search and empty-list messages;
  - fallbacks for missing posters, overviews, genres, ratings and release dates;
  - invalid movie ids.
- **Pagination**, an addition beyond the assignment's minimum. It pages both the popular and the
  search results with a compact page window (`1 … 9 10 11 … 500`), and is disabled while a page
  loads.
- **Accessibility:**
  - semantic landmarks and a labelled search form;
  - whole-card links named by the movie title, with visible keyboard focus throughout;
  - `aria-current` on the current page, and a live status region;
  - `role="alert"` for errors;
  - focus moves deliberately on Clear and on page changes.

## Tech Stack

- **Angular 22:** standalone components, zoneless change detection, `@if` / `@for` control flow and
  lazy routes.
- **TypeScript 6**, in strict mode.
- **Angular Signals** for application state. `rxResource` bridges signal state to HTTP requests.
- **RxJS**, limited to the `HttpClient` boundary.
- **Tailwind CSS v4.**
- **Vitest** for unit tests.

## Setup

1. **Prerequisites:** Node.js `^22.22.3 || ^24.15.0` and npm 10 or newer.
2. **Install the dependencies:**

   ```bash
   npm install
   ```

3. **Get a TMDb token.** Sign in at [themoviedb.org](https://www.themoviedb.org/) and open
   **Settings → API** (<https://www.themoviedb.org/settings/api>). Copy the **API Read Access
   Token**, the long token used as a Bearer header. Do not use the short API key.
4. **Create `src/environments/environment.local.ts`** with this content:

   ```ts
   // Local only: this file is gitignored. Do not commit it.
   export const environment = { tmdbAccessToken: 'YOUR_TMDB_API_READ_ACCESS_TOKEN' };
   ```

   Replace the placeholder with your token. `environment.local.ts` is listed in `.gitignore`.
   Never put a real token in `src/environments/environment.ts`, because that file is committed.

## Running locally

| Command               | Token used                                       | Use it for                               |
| --------------------- | ------------------------------------------------ | ---------------------------------------- |
| `npm run start:local` | `environment.local.ts`, swapped in at build time | Real TMDb requests (open localhost:4200) |
| `npm start`           | The committed empty token                        | Running without a token                  |

With `npm start`, TMDb rejects every request, and the app shows "TMDb access token is missing or
invalid. See README → Setup." `npm run build` also contains no token.

**About the credential.** This is a client-only app, so the TMDb read token is delivered to the
browser and is visible in its network requests. The local environment file only keeps the token
out of Git. Truly hiding the token would require a backend proxy, which is out of scope.

## Quality commands

```bash
npm test -- --watch=false   # unit tests (Vitest)
npm run lint                # ESLint (angular-eslint)
npm run format:check        # Prettier
npm run build               # production build
```

`ng test` loads `vitest-base.config.mjs`, which disables Vitest's persistent file-system module cache
(`fsModuleCache: false`). During development that cache once served stale transformed modules, so
a test run executed outdated source. With the cache disabled, every run tests the current code.

## Architecture

- **Components:** standalone components in one feature folder, `src/app/movies/`.
- **`MovieService`** owns the list state: the query, page, movies, loading, error and page count.
  - It exposes this state as read-only signals.
  - Its `{ query, page }` request state drives an `rxResource` that calls the typed HTTP methods
    `getPopularMovies(page)` and `searchMovies(keyword, page)`.
  - A new query or page cancels the request still in flight.
  - The list stays idle until the list page opens, so a direct link to a movie sends no list
    request.
- **`MovieDetail`** owns its own `rxResource` over `getMovieDetails(id)`. The route `:id` arrives as
  a signal input through `withComponentInputBinding()`.
- **`MoviePagination`** is a presentation-only component: page in, page out. Its page window is a
  pure function.
- **Page limit:** TMDb serves pages 1–500 only, so the usable page count is
  `min(total_pages, 500)`. Page 501 is never requested.
- **Libraries:** no state-management or UI component library is used.

The full design record, including the pagination amendment (§22), is in
[`.claude/docs/architecture-proposal.md`](.claude/docs/architecture-proposal.md).

## Development workflow

The project was built with a Claude Code multi-agent workflow:

- an **Architect** agent proposed designs and wrote task handoffs;
- a **Developer** agent implemented approved tasks and their focused tests;
- a **Reviewer** agent independently reviewed each change.

The human developer approved every architecture decision and scope change, ran the final browser
checks and validation, and made all commits. The workflow rules, agent definitions and design
records are in [`CLAUDE.md`](CLAUDE.md) and [`.claude/`](.claude/).

## Scope

These are deliberately excluded:

- authentication and user accounts;
- favourites and watchlists;
- cast, trailers and recommendations;
- URL synchronization of the search or page state;
- server-side rendering;
- a backend proxy for the TMDb token.
