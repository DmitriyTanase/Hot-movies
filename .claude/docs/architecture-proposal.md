# HOT Movies — Architecture Proposal

**Status: APPROVED — Architecture Gate #1**

- Approved on 2026-10-14 by the human developer.
- Final revision (3) applies the credential simplification required before approval.
- Authoritative requirements: `.claude/context/assignment.md`.
- Changes to these decisions require new explicit human approval.

---

## 0. Approved Decisions (Gate #1, 2026-10-14)

- Angular Signals are the state-management mechanism.
- No NgRx, SignalStore, or other state-management library.
- rxResource for movie-list async state.
- Required MovieService HTTP methods (getPopularMovies, searchMovies, getMovieDetails) return typed Observables.
- Simple timer-based 300 ms debounce in MovieSearch.
- Lazy list/detail routing design kept.
- List resource stays idle until MovieList activates it.
- English / en-US.
- Modern Angular naming conventions.
- Tailwind v4.
- Vitest.
- ESLint and Prettier.
- No pagination. No URL-synchronized search state. No SSR.
  - *Amended 2026-10-15 (T6):* pagination was later approved as an explicit extension beyond the assignment. See §22. URL sync and SSR remain excluded.
- TMDb Bearer Read Access Token.
- Use the pinned Angular CLI through npx, not the global ng (13.3.8).
- The proposed `ng new` command is approved in principle; a dry run must be performed before actual initialization.
- **Credentials (final):**
  - Angular environment files plus `fileReplacements`.
  - A committed `src/environments/environment.ts` holds an empty token.
  - A gitignored `src/environments/environment.local.ts` holds the real token.
  - A `local` build/serve configuration and an `npm run start:local` script use it.
  - No generator script, no npm lifecycle hooks, no backend (Section 13).

## 1. Requirements Summary

An Angular SPA on TMDb, built on the latest stable Angular, with:

- **Mandatory tech:** Signals for state, Tailwind CSS, standalone components, and the new control flow (`@if` / `@for` / `@switch`).
- **MovieService** with:
  - `getPopularMovies()`, `searchMovies(keyword: string)`, `getMovieDetails(id: number)`;
  - data stored and updated through signals;
  - loading and error state exposed (examples: `loadingSignal`, `errorSignal`, `moviesSignal`).
- **Movie list:** data comes through the service, with loading and error states. Each movie is a card component (poster, title, overview). Clicking a card routes to the details page.
- **Search:** input + "Search" button. Results update while typing. A cleared field restores popular movies.
- **Details page:** title, poster, overview, genres, rating, release date. Uses the Angular Router. "Back" button is desirable.
- **UI:** Tailwind, responsive, visually tidy.

## 2. Verified Versions and Tooling (2026-10-14)

### 2.1 Versions and compatibility

| Item | Finding | Source |
|---|---|---|
| Latest stable Angular | **22.2.2** (`@angular/core` and `@angular/cli` `latest` tag; `next` = 22.3.0-next.1) | `npm view @angular/core dist-tags`, `npm view @angular/cli dist-tags.latest` |
| Node for Angular 22 | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | angular.dev/reference/versions; `npm view @angular/cli@22.2.2 engines` |
| TypeScript for Angular 22 | `>=6.0.0 <6.1.0` | angular.dev/reference/versions; `@angular/compiler-cli@22.2.2` peerDeps |
| RxJS for Angular 22 | `^6.5.3 \|\| ^7.4.0` | angular.dev/reference/versions |
| Tailwind latest | **4.3.3**. `@angular/build@22.2.2` peer-accepts `tailwindcss ^2 \|\| ^3 \|\| ^4` | `npm view tailwindcss`, `npm view @angular/build@22.2.2 peerDependencies` |
| Tailwind + Angular integration | `@tailwindcss/postcss` + `postcss`, `.postcssrc.json` `{"plugins":{"@tailwindcss/postcss":{}}}`, `@import "tailwindcss";` in `src/styles.css`. Angular also documents `ng add tailwindcss`. CLI 22 `ng new --style tailwind` exists | tailwindcss.com/docs/installation/framework-guides/angular; angular.dev/guide/tailwind; `ng new --help` (CLI 22.2.2) |

### 2.2 Angular defaults (what `ng new` / the framework does for you)

- Zoneless change detection is the default since v21 (angular.dev/guide/zoneless).
- OnPush is the default change detection strategy since v22. `Eager` is the opt-out; `Default` is a deprecated alias of `Eager` (angular.dev/best-practices/skipping-subtrees, angular.dev/api/core/ChangeDetectionStrategy).
- `HttpClient` can be injected without `provideHttpClient()` since v21, and it uses the `fetch` backend by default (angular.dev/guide/http/setup).
- Standalone components are the default.
- The `ng new` defaults: `--strict` true, `--test-runner vitest`, `--file-name-style-guide 2025` (`ng new --help`). Vitest + jsdom is the default test setup (angular.dev/guide/testing).

### 2.3 Stable APIs used by this design

| API | Stability | Source |
|---|---|---|
| `rxResource` | stable since v22.0 | angular.dev/api/core/rxjs-interop/rxResource |
| `signal`, `computed`, `input`, `input.required`, control flow | stable | angular.dev |
| `withComponentInputBinding`, `withInMemoryScrolling`, `loadComponent`, route `title` | stable (no preview label) | angular.dev/api/router |

`rxResource` options: `params`, `stream`, `defaultValue`, `equal`, `injector`, `id` (angular.dev/api/core/rxjs-interop/RxResourceOptions).

### 2.4 Stable APIs considered and not used

| API | Stability | Why not used |
|---|---|---|
| `httpResource` | stable since v22.0 | Rejected, see D2 |
| `resource` | stable since v22.0 | Would bypass `HttpClient` |
| `linkedSignal` | stable since v20.0 | No longer needed, see Section 15. *T6 amendment:* used once, for the derived page count kept during loading (§22.3) |
| `outputFromObservable` | stable since v19.0 | No longer needed, see Section 15 |
| Signal Forms `form()` | stable since v22.0 | Unnecessary for one text field |
| `effect()`, `toSignal`, `toObservable` | stable | Not needed |
| `NgOptimizedImage`, `@defer` | stable | Unnecessary |
| SSR / hydration | stable | Inappropriate (out of scope) |

### 2.5 Preview / experimental APIs

- `debounced()` is **experimental** (angular.dev/guide/signals/debounced) and rejected. No experimental or preview API is used.

### 2.6 Resource semantics relied on

Source: angular.dev/guide/signals/resource, /api/core/ResourceStatus, /guide/http/http-resource.

- `params` returning `undefined` means the status is `idle` and the loader does not run.
- When params change, the outstanding load is aborted.
- `loading` clears `value()`. `reloading` keeps the previous value.
- Reading `value()` in the error state is unsafe. Guard reads with `hasValue()`.

### 2.7 TMDb authentication

- Two methods: the API Read Access Token as an `Authorization: Bearer` header (the **default** method), or the `api_key` query param.
- Both give the same level of access.
- TMDb gives no reason to avoid Bearer, so **Bearer is used**.
- Source: developer.themoviedb.org/docs/authentication-application.

### 2.8 Angular environments

- `fileReplacements` in `angular.json` build configurations is the documented environment mechanism.
- Multiple configurations can be combined with commas.
- Source: angular.dev/tools/cli/environments.

### 2.9 Local toolchain (read-only inspection, nothing changed)

| Check | Result | Suitability |
|---|---|---|
| `node -v` | v24.21.0 (`C:\Program Files\nodejs\node.exe`) | OK for Angular 22 (`^24.15.0`) |
| `npm -v` | **8.11.0** | Works (the CLI engine allows npm >= 8) but is very old. See below |
| Bundled npm | `C:\Program Files\nodejs\node_modules\npm` = **11.19.0** | Would be ideal |
| Why 8.11 runs | `npm config get prefix` = `C:\Users\Hi-tech\AppData\Roaming\npm`. A **global npm 8.11.0** is installed there, and the Node npm shim prefers the prefix copy | Shadowing. Recommend removing the global npm or upgrading it |
| Global `ng` | `AppData\Roaming\npm` `@angular/cli` **13.3.8** | **Must not be used.** It would scaffold Angular 13. Use `npx @angular/cli@22.2.2` |
| Global `node` npm package | `AppData\Roaming\npm\node_modules\node` 16.3.0 (shim on PATH *after* the real node.exe) | Currently harmless. Remove to avoid surprises |
| PowerShell | `npm.ps1` / `ng.ps1` blocked by execution policy (PSSecurityException) | Use Git Bash or `npm.cmd`, or set the CurrentUser policy to RemoteSigned (human action) |

## 3. Ambiguities (resolved interpretations)

- **"Results filter dynamically":** server search via `searchMovies`, debounced. Client-side filtering of 20 popular movies would not be a real search.
- **Input + button + dynamic results:** typing triggers a debounced search. The button and Enter trigger an immediate search.
- **Details state:** the required list signals live in `MovieService`. Details state is page-scoped (Section 6).
- **Back:** a `routerLink="/"` labelled "Back to movies". List state lives in the root service, so the previous search and results reappear without a refetch.

## 4. Architecture

```
src/environments/environment.ts        committed: { tmdbAccessToken: '' } + "never put a real token here"
src/environments/environment.local.ts  GITIGNORED: real token; swapped in by the `local` configuration
src/styles.css                      @import "tailwindcss";
src/app/
  app.ts / app.html                 shell: header + <router-outlet>
  app.config.ts                     provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling(...))
  app.routes.ts
  movies/
    movie.ts                        TMDb-shaped types (only fields used)
    tmdb.ts                         API/image base URLs, posterUrl(path, size)
    error-message.ts                errorMessage(err): user-facing string
    movie.service.ts                TMDb HTTP operations + list state
    movie-list/                     routed page: search + list states + grid
    movie-search/                   input + Search button + clear; debounce
    movie-card/                     card = link to details
    movie-detail/                   routed page: details resource + rendering
```

- One feature folder.
- One service: no facade, repository, API-client class, interceptor or mapper layer.
- `HttpClient` uses the v21+ default provider, so there is no `provideHttpClient()` (tests still use `provideHttpClient()` + `provideHttpClientTesting()`).

## 5. MovieService API (resolves revision item 1)

### 5.1 TMDb operations: the three methods the assignment requires

| Method | Does | Returns |
|---|---|---|
| `getPopularMovies()` | `GET {api}/movie/popular?language=en-US&page=1` | `Observable<Movie[]>` (`map(r => r.results)`) |
| `searchMovies(keyword: string)` | `GET {api}/search/movie?query={keyword}&include_adult=false&language=en-US&page=1` | `Observable<Movie[]>` |
| `getMovieDetails(id: number)` | `GET {api}/movie/{id}?language=en-US` | `Observable<MovieDetails>` |

- All three add the `Authorization: Bearer <token>` header through one private `HttpHeaders` constant. The token comes from `environment.tmdbAccessToken` (Section 13).
- They are cold, typed and cancellable: unsubscribing aborts the request.
- They hold no state.

### 5.2 List state: signals in the same service, driven by those methods

```ts
// undefined = list not requested yet -> resource idle -> no HTTP
private readonly query = signal<string | undefined>(undefined);

private readonly list = rxResource({
  params: () => this.query(),
  stream: ({ params: q }) => (q ? this.searchMovies(q) : this.getPopularMovies()),
});

readonly querySignal   = computed(() => this.query() ?? '');
readonly moviesSignal  = computed(() => (this.list.hasValue() ? this.list.value() : []));
readonly loadingSignal = this.list.isLoading;
readonly errorSignal   = computed(() => (this.list.error() ? errorMessage(this.list.error()) : null));

loadList(): void { if (this.query() === undefined) this.query.set(''); } // start popular once
setQuery(keyword: string): void { this.query.set(keyword.trim()); }      // '' = popular
reloadList(): void { this.list.reload(); }                                // Retry
```

### 5.3 Why this satisfies the assignment and reads intuitively

- **The required methods do exactly what their names say:** each fetches typed TMDb data. A reader of the assignment finds them immediately.
- **"The service uses signals for storing and reactively updating data" and "provides loading and errors":** `moviesSignal`, `loadingSignal` and `errorSignal` are public, read-only signals on `MovieService`. They use the assignment's own example names.
- **One mechanism keeps them updated:** an `rxResource` whose loader calls `searchMovies()` / `getPopularMovies()`.
- **No contradictory states:** the three signals derive from one resource, never from three hand-written flags. The resource `status` is the state machine.
- **Three small commands** (`loadList`, `setQuery`, `reloadList`) are the only way the UI changes list state.

## 6. State Model

| State | Owner | Lifecycle | Representation |
|---|---|---|---|
| Committed list query | `MovieService.query` (`undefined` = not started, `''` = popular) | App lifetime (root) | `signal` |
| Movies / loading / error | `MovieService.list` | App lifetime | `rxResource` → `moviesSignal`, `loadingSignal`, `errorSignal` |
| Search draft text | `MovieSearch` | Component lifetime | `signal`, initialised once from `querySignal()` |
| Pending debounce timer | `MovieSearch` | Component lifetime, cleared on destroy | plain field |
| Movie details | `MovieDetail` | Route activation | component-local `rxResource` calling `getMovieDetails(id)` |
| Route `id` | Router → `MovieDetail` input | Route activation | `input.required<string>()` + `computed` parse |

**Why the list state is in the service and the details state is in the page:**

- The assignment requires the list signals to be in the service.
- List state must survive navigation, so "back to list" restores the query and results with no refetch.
- Details are route-scoped. Local ownership gives automatic cleanup and cancellation when moving between movies, and no stale details flash.

## 7. List Resource Lifecycle (resolves revision item 2)

**Finding:** in revision 1 the list resource was a field of the root `MovieService`, with an initial query of `''`. The details page injects `MovieService` (it needs `getMovieDetails`). On a direct `/movie/:id` load, that injection constructs the service, which creates the resource. A resource with a defined `params` loads as soon as it is created, so **yes, the popular request fired on a details deep-link**.

**Fix (simplest, no new layer):**

- The query starts as `undefined`. `params` returns `undefined`, so the resource is `idle` and no request is sent.
- `MovieList` calls `movieService.loadList()` in its constructor. That sets the query to `''` only if it is still `undefined`.
- On return navigation the query is already set, so `loadList()` is a no-op and the cached results are shown.
- QA test: navigate directly to `/movie/1` and expect exactly one request (details) and none to `/movie/popular`.

## 8. Signals / RxJS Boundary

| Concern | Tool | Reason |
|---|---|---|
| TMDb HTTP operations | RxJS (`HttpClient` Observables) | Typed, cancellable on unsubscribe, testable with `HttpTestingController` |
| Async → state bridge (switch/cancel) | `rxResource` | Param change unsubscribes the previous Observable, and `HttpClient` aborts it |
| App state (query, list, loading, error) | `signal` / `computed` / resource signals | Synchronous template reads. Drives zoneless/OnPush rendering |
| Derived view values (poster URL, "Not rated", empty-state text) | `computed` / pure helpers / template | Synchronous, so RxJS adds nothing |
| Keystroke debounce | One `setTimeout` / `clearTimeout` in `MovieSearch` | See D3. Three triggers must cancel each other, and an explicit timer is the simplest correct form |

`effect()` is not used. `toSignal` / `toObservable` are not used. `rxResource` is the only Signals↔RxJS bridge.

## 9. Search Behaviour (resolves revision item 3)

`MovieSearch` injects `MovieService`. It holds a `draft = signal(movieService.querySignal())` and one `pendingTimer`.

| User action | Behaviour |
|---|---|
| Type non-blank text | `clearTimeout(pending)`, then `pending = setTimeout(() => setQuery(draft), 300)` |
| Type until the field is empty or whitespace-only | `clearTimeout(pending)`, then **immediate** `setQuery('')` → popular |
| Press Search button / Enter (`<form (ngSubmit)>` or `(submit)`, button `type="submit"`) | `clearTimeout(pending)`, then **immediate** `setQuery(draft)` |
| Click clear (x) (shown when `draft()` is non-empty) | `draft.set('')`, `clearTimeout(pending)`, **immediate** `setQuery('')` |
| Component destroyed (for example a card is clicked within 300 ms of typing) | `DestroyRef.onDestroy(() => clearTimeout(pending))`. No late search after leaving the page |

Guarantees:

- **No stale debounced emission:** every immediate path clears the pending timer first, so a debounced search can never fire after a submit, clear or navigation.
- **Whitespace equals empty:** `setQuery` trims, so `'   '` becomes `''` (popular).
- **No duplicate request for the same effective query:** `query` is a signal with default equality. `'bat'`, then `'bat '`, then submitting `'bat'` again results in one request.
- **Rapid typing / stale responses:** the debounce collapses keystrokes into one commit. When the committed query changes while a request is in flight, the resource aborts it (unsubscribe → `HttpClient` cancels). A late response cannot overwrite newer results, by construction, with no request IDs or manual `switchMap`.
- **Loading during search:** the status is `loading` (value cleared) and a skeleton grid is shown. The input stays usable.
- **Error during search:** the error panel shows a Retry button (`reloadList()`). Any new query clears the error automatically. Re-submitting the *same* query after an error is a no-op (dedupe), so the Retry button is the retry path.

**Where each concern lives and why:**

- **Debounce is in the component** because it is input-timing UX.
- **Cancellation is in the service resource** because it is a data concern: whoever changes the query, the in-flight request for the old query must die.

## 10. Component Boundaries

| Component | Inputs / deps | Responsibility |
|---|---|---|
| `App` | none | Header ("HOT Movies") + `<router-outlet>` |
| `MovieList` (route `''`) | `MovieService` | Calls `loadList()`. Renders `<app-movie-search>`, then error + Retry / skeleton / empty ("No movies found for "x"." vs "No movies available.") / grid via `@for (m of movies(); track m.id)`. Has an `aria-live` status line |
| `MovieSearch` | `MovieService` | `role="search"` form, visually-hidden label, input, Search submit button, clear button. Owns the debounce timer |
| `MovieCard` | `movie = input.required<Movie>()` | Whole card is `<a [routerLink]="['/movie', movie().id]">`. Poster (`loading="lazy"`, `alt` = title) or a 2:3 "No poster" placeholder. Title. Overview `line-clamp-3` or "No description available." |
| `MovieDetail` (route `movie/:id`) | `id = input.required<string>()`, `MovieService` | `rxResource({ params: () => validId() ?? undefined, stream: ({params}) => svc.getMovieDetails(params) })`. `@switch` on status. Shows title, poster, overview, genre chips, rating (`x.x / 10`, "Not rated" when `vote_count === 0`), release date (`DatePipe`, "Unknown" if empty). "Back to movies" link. Retry on error |

- No shared generic components until reuse is real.
- `MovieSearch` injects the service directly instead of using inputs and outputs. It is a single-use feature component, and this removes the input/output plumbing plus the `linkedSignal` / `outputFromObservable` it needed.

## 11. Routing

```ts
[
  { path: '', title: 'HOT Movies', loadComponent: () => import('./movies/movie-list/movie-list').then(m => m.MovieList) },
  { path: 'movie/:id', title: 'Movie details', loadComponent: () => import('./movies/movie-detail/movie-detail').then(m => m.MovieDetail) },
  { path: '**', redirectTo: '' },
]
provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))
```

- **`withComponentInputBinding`:** the route `id` arrives as a signal input, with no `ActivatedRoute` subscription.
- **`withInMemoryScrolling({scrollPositionRestoration: 'enabled'})`:** kept for a concrete reason. Without it, clicking a card far down the grid opens the details page scrolled down, because the router keeps the scroll position on forward navigation. With it, forward navigation goes to the top and browser Back restores the list position.
- **`loadComponent`:** zero-cost, standard lazy routes.
- **Invalid id** (not a positive integer): params is `undefined`, the resource stays `idle`, and the page shows "Invalid movie id" + Back. TMDb 404 shows "Movie not found".

## 12. Data Access and Typing

- **Types in `movie.ts`** mirror the TMDb response shape, limited to the fields the UI uses:
  - `Movie { id; title; overview; poster_path: string | null; release_date: string; vote_average: number; vote_count: number }`
  - `MovieDetails extends Movie { genres: { id: number; name: string }[] }`
  - `TmdbPage<T> { page; results: T[]; total_pages; total_results }`
- **No DTO → model mapping layer.** The app displays TMDb data 1:1. The only transformation is the poster URL, done by `posterUrl(path, 'w342' | 'w500'): string | null` in `tmdb.ts`. Empty `release_date` and `null` poster are handled in templates. A parallel camelCase model would double the types for no behavioural gain.
- **Images:** constant base `https://image.tmdb.org/t/p/`. The `/configuration` endpoint is not called.
- **No runtime schema validation** library.
- **`error-message.ts`:** `errorMessage(err: unknown): string`. It unwraps `err.cause` if the resource wrapped the error, then finds the `HttpErrorResponse` status:
  - `401` → "TMDb access token is missing or invalid. See README → Setup."
  - `404` → "Movie not found."
  - `0` → "Network error. Check your connection."
  - anything else → "Something went wrong loading movies. Please try again."

  It is kept because the 401 message is what turns a missing token into an explained, actionable error (Section 13).

## 13. Credentials and Local Setup (FINAL — approved)

### 13.1 Honest statement

- This is a browser-only app. Whatever token it uses is compiled into the JS bundle and visible in DevTools request headers. **It is not secret.**
- Truly hiding it would need a backend proxy, which is out of scope and will not be built.
- The mitigation:
  - use TMDb's read-only API Read Access Token;
  - never commit it;
  - state the limitation in the README.

### 13.2 Comparison (credential simplification requested at Gate #1)

| Option | Commit safety | Fresh clone | Reviewer friction | Code / config size | Interview explainability |
|---|---|---|---|---|---|
| `.env` + Node generator + 4 npm lifecycle hooks (rev. 2) | Good (`.env` gitignored) | Compiles (postinstall generates the file) | Low: copy `.env`, `npm start` | Script approx. 15 lines + 4 hooks + generated file. Implicit magic | Medium. "Why a code generator for one string?" |
| Committed placeholder `environment.ts` that each developer edits | **Poor.** The real token sits in a tracked file. Prevention relies on `git update-index --skip-worktree` per clone (fragile, invisible) | Compiles | Low | Smallest | Weak, because commit safety depends on discipline |
| **Angular environments + `fileReplacements`:** committed `environment.ts` (empty token), gitignored `environment.local.ts`, a `local` configuration | **Good.** The real token only ever lives in a gitignored file | **Compiles and runs** with the default config (empty token → explained in-app 401 message) | Low: copy one file, paste the token, `npm run start:local` | approx. 12 lines of `angular.json` + 1 script + 1 committed file. **Zero runtime code** | **High.** Angular's documented environment mechanism |
| Gitignored runtime JSON in `public/` fetched by `provideAppInitializer` | Good | Compiles. A missing file is a handled in-app error | Low: copy JSON, refresh | approx. 20 lines runtime code + async bootstrap + test stubbing | Good, but adds startup I/O the app doesn't otherwise need |
| Token typed into the UI and stored in `localStorage` | Best (nothing in the repo) | Compiles | **Highest:** an extra in-app setup step | A settings form = new UI scope | Unusual for a take-home. Scope expansion |

**Decision: Angular environments + `fileReplacements`.** It is the smallest option that meets all six constraints:

- no runtime code;
- no generator;
- no lifecycle hooks;
- no async bootstrap;
- it uses the framework's own documented mechanism.

### 13.3 Mechanism

1. **Committed `src/environments/environment.ts`:**
   ```ts
   // Never put a real token in this file; it is committed.
   // Put your token in environment.local.ts (gitignored); see README → Setup.
   export const environment = { tmdbAccessToken: '' };
   ```
2. **Gitignored `src/environments/environment.local.ts`:** same shape, with the real token. Created by the developer or reviewer by copying `environment.ts`. There is no separate example file: `environment.ts` *is* the template.
3. **`angular.json`:**
   - `build.configurations.local`: the same options as `development` (unoptimised, source maps) plus
     `"fileReplacements": [{ "replace": "src/environments/environment.ts", "with": "src/environments/environment.local.ts" }]`.
   - `serve.configurations.local`: `{ "buildTarget": "hot-movies:build:local" }`.
4. **`package.json` script:** `"start:local": "ng serve --configuration local"`. This is an ordinary script, not a lifecycle hook.
5. **`.gitignore`:** `src/environments/environment.local.ts` (added in the initialization task, before any real value exists).
6. **`MovieService`** reads `environment.tmdbAccessToken` into its private `HttpHeaders` constant.
7. Unit tests use the committed `environment.ts` (empty token). They are deterministic and never need a real token.

### 13.4 Reviewer flow (README → Setup)

```
git clone … && cd hot-movies
npm install
cp src/environments/environment.ts src/environments/environment.local.ts
# edit environment.local.ts: paste your TMDb "API Read Access Token" into tmdbAccessToken
npm run start:local
```

### 13.5 Failure modes, all explained

- **Fresh clone, no setup:** `npm start`, `npm run build` and `npm test` all compile. Once the movie feature exists, the app shows "TMDb access token is missing or invalid. See README → Setup." (mapped 401).
- **`npm run start:local` without creating `environment.local.ts`:** the build fails with a file-replacement error that names `environment.local.ts`. The user explicitly opted into the configuration, and the README step precedes it.
- **Token pasted into `environment.ts` by mistake:** guarded by the file's header comment. The README warns about it, and `git diff` / `git status` will show the change before commit.

Production builds (`npm run build`) intentionally contain no token. A token-bearing production build is not required for review. If it is ever needed, a separate configuration would be added, with human approval.

## 14. Error / Loading / Empty States

| Situation | List page | Details page |
|---|---|---|
| Loading | Skeleton grid, `aria-busy="true"` | Skeleton block |
| Error | Message + Retry | Message + Retry + Back |
| Empty popular | "No movies available." | n/a |
| Empty search | "No movies found for "query"." | n/a |
| Invalid id | n/a | "Invalid movie id" + Back |
| Missing poster | 2:3 placeholder, "No poster" | Same |
| Missing overview / date / rating | "No description available." | "Unknown" / "Not rated" |

**UI:**

- Tailwind v4, CSS-first configuration (no `tailwind.config.js`), no component library.
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`. Details page is stacked on mobile, with the poster beside the text from `md:`.
- Visible `focus-visible` rings and semantic landmarks.

**Change detection:** v22 defaults (zoneless, OnPush). No `zone.js`, no explicit `changeDetection` metadata, no `markForCheck`.

## 15. Final Challenge (resolves revision item 7)

| Item | Verdict | Reason |
|---|---|---|
| Auth interceptor | **Removed** | Three requests in one service. A private `HttpHeaders` constant is simpler and keeps auth visible where the requests are made |
| DTO → model mapper layer | **Removed** | The data is displayed 1:1. Only the poster URL needs computing (`posterUrl()` helper) |
| `linkedSignal` search draft | **Removed** | `MovieSearch` now injects the service and seeds `draft = signal(querySignal())` once at construction |
| `outputFromObservable` + RxJS debounce in component | **Removed** | Replaced by one explicit timer. It correctly cancels on submit, clear and destroy without merge/debounce-selector subtleties |
| `TMDB_ACCESS_TOKEN` InjectionToken | **Removed** | The service imports `environment`. Tests use the committed empty-token `environment.ts` (header value is asserted as-is) |
| `.env` generator script + npm lifecycle hooks | **Removed (Gate #1)** | Replaced by Angular's own environment `fileReplacements` (Section 13) |
| Separate `tmdb/` folder | **Removed** | Merged into `movies/tmdb.ts` |
| `provideHttpClient()` | **Removed** | Default provider in v21+ |
| `error-message.ts` | **Kept, reduced** to 4 cases | Needed for the explained missing-token path and the 404 "Movie not found" |
| `withInMemoryScrolling` | **Kept** | Fixes a real "details page opens scrolled down" bug |
| `withComponentInputBinding` | **Kept** | Less code than `ActivatedRoute` |
| `rxResource` | **Kept** | The core of state, cancellation and consistency. See D2 |
| `loadComponent` | **Kept** | Zero complexity cost |

Other challenge questions:

- **Signals overuse?** There are no effects and no signal per micro-flag. Draft text is the only local signal.
- **RxJS overuse?** RxJS is confined to `HttpClient` return values.
- **TMDb failure?** A mapped message and Retry. `hasValue()` guards prevent a throw.
- **Search cleared?** Popular is restored immediately.
- **Missing poster?** Placeholder.
- **Anything present only to look advanced?** Nothing left.

## 16. Technology Decisions

**D1 — Initialisation (APPROVED in principle; executed by the Developer per `.claude/context/task-handoff.md`, after the human fixes the toolchain)**

- Fix the toolchain first (Section 2.9).
- Then run in the repo root, first with `--dry-run`:
  `npx @angular/cli@22.2.2 new hot-movies --directory . --style tailwind --routing --ssr=false --zoneless --test-runner vitest --ai-config none --skip-git --package-manager npm`
- Why these flags:
  - It pins the verified version and bypasses the global CLI 13.3.8.
  - `--ai-config none` protects the existing `CLAUDE.md`.
  - `--skip-git` because the repo already exists.
  - The dry run reveals conflicts with the existing `README.md`.
- Then `ng add angular-eslint` and Prettier (accepted).

**D2 — List state mechanism (revision item 6)**

| Option | Clarity | Cancellation | Signals shown | Fits the item 1 API | Code / risk |
|---|---|---|---|---|---|
| **`rxResource`** (APPROVED) | One declaration: params = query, stream = the required methods | Automatic (unsubscribe on param change) | Yes: state is signals derived from a resource | **Yes**, it calls `getPopularMovies()` / `searchMovies()` | Smallest. Gotchas: `hasValue()` guard, error `cause` unwrap, `TestBed.tick()` in tests |
| `httpResource` | Very concise | Automatic | Yes | **No.** It issues its own request from a URL, so `getPopularMovies()` / `searchMovies()` would sit unused or duplicate the request logic | Contradicts the human's preferred API |
| Manual `Subject` + `switchMap` + `catchError` writing 3 signals | Familiar but longer (approx. 20 lines) | Correct with `switchMap` | Signals become write targets of an RxJS pipeline | Yes | Three independently written flags, `catchError` must be inside `switchMap`, retry needs last-query tracking, dedupe interacts with retry |

- **APPROVED:** `rxResource`. It is stable in v22. It is the one option that both reuses the required Observable methods *and* makes the signals truly derived state.

**D3 — Debounce implementation**

- **APPROVED:** a plain timer in `MovieSearch` (Section 9).
- **Alternative:** RxJS in the component, `events$.pipe(switchMap(e => e.immediate ? of(e.text) : timer(300).pipe(map(() => e.text))))` + `takeUntilDestroyed`. Correct and idiomatic, but more concepts for the same behaviour.
- **Rejected:** the experimental `debounced()`.

**D4 — Details state:** component-local `rxResource` over `getMovieDetails(id)`.

**D5 — Types:** TMDb-shaped interfaces, no mapper (Section 12).

**D6 — Credentials (APPROVED):** Angular environment files + `fileReplacements` `local` configuration + `npm run start:local`. No generator, no hooks, no backend (Section 13).

**D7 — Change detection:** defaults (zoneless + OnPush).

**D8 — Dependencies:** no runtime dependencies beyond Angular, RxJS and Tailwind. Dev-only: angular-eslint and Prettier (accepted).

## 17. Testing Strategy

Tools:

- Vitest (default), with `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController`.
- `RouterTestingHarness`.
- `vi.useFakeTimers()`.

QA owns the spec files. No E2E framework. Coverage percentage is not a goal.

| Target | Behaviour protected |
|---|---|
| `MovieService` HTTP methods | Correct URL/params, Bearer header, typed result (`results` extracted) |
| `MovieService` list state | No request before `loadList()`. `loadList()` sends popular. `setQuery('x')` sends search. A second `setQuery` while pending cancels the first (`req.cancelled`). `'  '` restores popular. The same query sends no new request. Error sets `errorSignal`, and `loadingSignal` becomes false. `reloadList()` refetches. `loadList()` after a search is a no-op |
| Deep link | `/movie/1` sends exactly one request (details) and no popular request |
| `MovieSearch` | Typing commits after 300 ms only. Submit/Enter commits immediately and cancels the pending timer (no second commit at 300 ms). Clear/empty commits `''` immediately. Destroy cancels the pending timer. Draft seeds from `querySignal` |
| `MovieList` | Loading / error+Retry / empty (query-aware) / N cards |
| `MovieCard` | Poster vs placeholder, overview fallback, `href="/movie/{id}"` |
| `MovieDetail` | All six fields. 404 message. Invalid id. Back link → `/` |
| `errorMessage` | 401 / 404 / 0 / other / wrapped `cause` |

Resource loads are asynchronous. Specs must flush with `TestBed.tick()` / `await fixture.whenStable()` before asserting on requests.

Tests always run against the committed `environment.ts` (empty token). No spec may depend on `environment.local.ts`.

Static checks: `npm run build` (strict), `npm test` (non-watch), `npm run lint`, `npm run format:check`.

## 18. Risks

1. **Toolchain:** global npm 8.11 shadows npm 11.19, global `ng` is 13.3.8, and PowerShell blocks `.ps1` shims. Mitigation: always use `npx @angular/cli@22.2.2` (or the project-local `ng` after init) and fix npm before init.
2. **Resource details:** `value()` in the error state, and error wrapping (`cause`). Mitigation: `hasValue()` guard, unwrap in `errorMessage`, verify in the first tests.
3. **Async resource tests** need explicit flushing.
4. **`ng new --directory .`** in a non-empty repo may conflict with `README.md`. Mitigation: `--dry-run`.
5. **Wrong start command:** a reviewer who runs `npm start` instead of `npm run start:local` gets an empty token. Mitigation: the README Setup section is explicit, and the in-app 401 message points to it.
6. **Token pasted into the committed `environment.ts`:** guarded by the file header comment, a README warning, and `git status` / diff review before any human commit.
7. **Token visibility** in the browser is unavoidable and documented.
8. **Skeleton flash** on each committed query (`loading` clears the value). Accepted; can be refined later if needed.

## 19. Interview Defense

- **"Your service has both `searchMovies()` and `setQuery()`. Why?"** `searchMovies()` is the TMDb operation the assignment asks for: typed, cancellable, stateless. `setQuery()` changes *which* operation feeds the list state. The `rxResource` connects the two and gives atomic loading/error/data plus cancellation.
- **"Race conditions?"** A query change makes the resource unsubscribe from the in-flight Observable, and `HttpClient` aborts it. Stale responses are impossible by construction.
- **"Why not `httpResource`?"** It would bypass the required service methods. `rxResource` reuses them.
- **"Why `setTimeout` instead of `debounceTime`?"** One timer with three cancelling triggers (submit, clear, destroy) is explicit and obviously correct. The RxJS version needs `switchMap` + `timer` for the same behaviour. Both are valid; this one is simpler.
- **"Why no `effect()`?"** All state is derived; effects are for syncing to non-reactive APIs.
- **"Why no NgRx / SignalStore?"** One list, one detail view. A root service with signals is the store.
- **"Deep link to details?"** The list resource stays `idle` until the list page calls `loadList()`, so only the details request is sent.
- **"Is the token secret?"** No. Browser apps cannot keep secrets. It is a read-only token, out of Git, and a proxy would be the real fix.
- **"How is the token configured?"** With Angular's standard environment files. The committed `environment.ts` has an empty token. A gitignored `environment.local.ts` is swapped in by the `local` configuration through `fileReplacements`. Nothing is generated, there is no runtime config fetch, and a fresh clone always compiles.
- **"Why no DTO mapping?"** The data is displayed 1:1, so mapping would duplicate types. The one real transformation (poster URL) is a pure helper.
- **"Zoneless / OnPush?"** Both are v22 defaults, and signal-driven templates need nothing extra.

## 20. Open Items (after Gate #1 approval)

All architecture decisions are resolved (Section 0). Remaining human actions and checks before or during implementation:

1. **Toolchain fix (human action, blocking initialization):**
   - remove or upgrade the global npm 8.11.0 in `%APPDATA%\npm` so `npm -v` reports a modern npm (bundled 11.19.0);
   - do not use the global `ng` 13.3.8;
   - optionally remove the global `node` 16.3.0 package;
   - use Git Bash / `npm.cmd`, or set the PowerShell CurrentUser execution policy.
2. **`README.md` conflict:** the existing one-line `README.md` (`# Hot-movies`) will probably conflict with the `ng new` scaffold. The dry run decides. If it conflicts, the human chooses how to resolve it (see the task handoff, Open Questions).

## 21. Confidence

- **High:** requirement coverage, the service API, search behaviour, and the deep-link fix.
- **Medium-High:** resource-specific details (error wrapping, test flushing), to be confirmed by the first service tests.

---

## 22. Amendment A1 — Pagination (T6; APPROVED 2026-10-15)

**History:**

- Gate #1 excluded pagination (§0). The assignment does not require it.
- The human developer approved it later as an explicit extension, for T6 only.
- Supporting analysis: `.claude/docs/t6-pagination-proposal.md`.

Wherever they conflict on list paging, this section overrides §5.1, §5.2, §6, §9 (dedupe and clear rows), §10, §14 and §17. All other decisions are unchanged:

- no URL sync and no SSR;
- no state or UI libraries;
- the list state stays in `MovieService`;
- the deep-link idle start;
- details state stays local;
- the credential strategy.

### 22.1 TMDb paging facts

- **Documented:** `GET /movie/popular` and `GET /search/movie` take an integer `page`, default 1. They return `page`, `results`, `total_pages` and `total_results`.
- **Documented limit:** error code 22 says "Pages start at 1 and max at 500".
- **Decision:** `TMDB_MAX_PAGE = 500` lives in `tmdb.ts`. The usable page count is `min(total_pages, TMDB_MAX_PAGE)`. Page 501 or higher is never shown or requested.
- **Assumptions:** the limit applies to both endpoints, `total_pages` may exceed 500 or be 0, and popular's totals may drift.

### 22.2 API contract (H2)

- `getPopularMovies(page = 1): Observable<TmdbPage<Movie>>`.
- `searchMovies(keyword: string, page = 1): Observable<TmdbPage<Movie>>`.
- `getMovieDetails` is unchanged.
- The full `TmdbPage<Movie>` (existing type) is returned. There is no app-level page DTO and no mapping.

### 22.3 List state

- **Request state:** `params = signal<{ query: string; page: number } | undefined>(undefined)`.
  - `undefined` means idle, so a deep link sends no request (§7 is unchanged).
  - The commands check before setting `params`, so no custom `equal` is needed.
- **Resource:** `rxResource({ params: () => params(), stream: ({params: {query, page}}) => query ? searchMovies(query, page) : getPopularMovies(page) })`. A change to `params` aborts the in-flight request, as before.
- **Derived signals:**
  - `querySignal`;
  - `pageSignal`: the requested page;
  - `moviesSignal`: `results`, or `[]`;
  - `loadingSignal`, `errorSignal`: unchanged;
  - `totalPagesSignal`: the usable page count.
- **`totalPagesSignal` (H4, modified):** a `linkedSignal` derived from the query, the loaded `total_pages` and the error state. This is the only use of `linkedSignal`. It is derived rather than written by hand, and needs no `effect()`.
  - When loaded, it is `min(total_pages, 500)`.
  - While loading for the **same** query, it keeps the previous value, so the pager stays visible but disabled.
  - On a query change it is 0 until the new metadata arrives.
  - On error it is 0.
- **Commands:**
  - `loadList()`: unchanged.
  - `setQuery(keyword)`: `''` always becomes popular page 1. The same non-empty query is a no-op that keeps the page (H3). A new query goes to page 1.
  - `goToPage(page): boolean`: valid only for an integer page in `1..totalPagesSignal()` that differs from the current page, and only while loaded with no error. Otherwise it is a no-op and returns `false`.
  - `reloadList()`: retries the same query and page.

### 22.4 `MoviePagination` (§10 addition)

- **Purpose:** presentation-only. It knows nothing of TMDb, `MovieService`, HTTP or queries.
- **API:** `currentPage = input.required<number>()`, `totalPages = input.required<number>()`, `disabled = input(false)`, `pageChange = output<number>()`. It emits only valid pages that differ from the current page.
- **Markup:** `<nav aria-label="Pagination">` containing native `<button>`s. Previous and Next are disabled at the ends. The current page has `aria-current="page"`. The ellipsis is `aria-hidden`. It renders nothing when `totalPages ≤ 1`.
- **Window:** a pure `pageWindow(current, total)` with one sibling (H5) and 7 slots, as in the proposal §5.2. For example 10/500 gives `1 … 9 10 11 … 500`.
- **Placement:** `MovieList` renders it below the results while `totalPagesSignal() > 1` and there is no error, with `disabled` bound to `loadingSignal()`.
- **Focus (H7):** an accepted user page change (`goToPage` returns `true`) focuses the results region (`tabindex="-1"`). It is an imperative call in the event handler, not an `effect()`. Focus does not move on initial load, search, Retry or return from details.

### 22.5 Unchanged guarantees

- Back from details: `loadList()` is a no-op, so the query, page and results are kept with no refetch.
- A deep link to `/movie/:id` sends no list request.
- The 300 ms debounce and timer cancellation (§9) still apply. Clear clears the pending timer before `setQuery('')`.
