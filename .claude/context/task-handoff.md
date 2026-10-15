# Task Handoff — T6: Pagination (Popular + Search)

- **Architecture:** `.claude/docs/architecture-proposal.md` **§22 (Amendment A1, APPROVED 2026-10-15)**. It is authoritative for T6, and the earlier sections apply wherever §22 doesn't override them.
- **Supporting analysis:** `.claude/docs/t6-pagination-proposal.md`. Use §5.2 for the window algorithm and its fixture table, and §6 for the transition detail.
- **Requirements:** pagination is a human-approved extension beyond `.claude/context/assignment.md` (H1). Every assignment requirement must still hold.
- **Base:** T5 committed. **Owner:** Developer, who writes the focused tests (Resolved Decision 2). Reviewer/QA validates independently afterwards.

## Goal

Add paging to the popular and search lists inside the existing `MovieService` list state. Add a small presentation-only `MoviePagination` component below the list results. Do not commit.

## Invariants (must hold)

- **Ownership:** `MovieService` owns the list state. `{ query, page }` is the resource's request state.
- **Deep link:** a direct `/movie/:id` load sends no list request. The resource stays idle until `loadList()`.
- **Back from details:** the query, page and results survive with no intentional refetch.
- **Signals and RxJS:**
  - Signals hold the state, and RxJS appears only at the HTTP boundary.
  - Use no `effect()`, `toSignal` or `toObservable`.
  - `linkedSignal` is allowed **only** for `totalPagesSignal`, per §22.3.
- **Exclusions:**
  - no pagination, state or UI dependencies;
  - no URL query or page sync;
  - no changes to `MovieDetail`, routes, `app.config.ts`, the credential strategy, or `MovieSearch` behaviour;
  - no unrelated refactoring.
- **Human-owned `src/environments/environment.local.ts`:**
  - never inspect, print, grep, hash, copy, modify or delete it;
  - never run `start:local`, `--configuration local` or `--build-target=…:local`;
  - limit searches to `src/app`;
  - only `stat -c '%s %Y'`, `ls`, `git check-ignore` and `git status` are allowed on it.

## Preconditions

- `git status` is clean, apart from this handoff and the two doc files changed for T6.
- Build, `npm test -- --watch=false` (it must log `vitest-base.config.mjs`), lint and format:check all pass.
- Record the human-owned file's `stat`.

## Contract (§22)

### `tmdb.ts`

`export const TMDB_MAX_PAGE = 500;`

### `MovieService`

```ts
getPopularMovies(page = 1): Observable<TmdbPage<Movie>>        // params language=en-US, page
searchMovies(keyword: string, page = 1): Observable<TmdbPage<Movie>> // + query, include_adult=false
getMovieDetails(id: number): Observable<MovieDetails>           // unchanged

private readonly params = signal<{ query: string; page: number } | undefined>(undefined);
private readonly list = rxResource({
  params: () => this.params(),
  stream: ({ params: { query, page } }) =>
    query ? this.searchMovies(query, page) : this.getPopularMovies(page),
});

readonly querySignal   = computed(() => this.params()?.query ?? '');
readonly pageSignal    = computed(() => this.params()?.page ?? 1);   // requested page
readonly moviesSignal  = computed(() => (this.list.hasValue() ? this.list.value().results : []));
readonly loadingSignal = this.list.isLoading;
readonly errorSignal   = /* unchanged */;
readonly totalPagesSignal = linkedSignal({
  source: () => ({
    query: this.params()?.query,
    total: this.list.hasValue() ? this.list.value().total_pages : undefined,
    failed: !!this.list.error(),
  }),
  computation: (src, prev) =>
    src.failed ? 0
    : src.total !== undefined ? Math.min(src.total, TMDB_MAX_PAGE)
    : prev && prev.source.query === src.query ? prev.value   // same-query page load: keep
    : 0,                                                     // new query / initial: unknown
});
```

The `totalPagesSignal` block is a sketch. Keep its semantics, and make it read-only if you expose it, for example through `.asReadonly()` on a private field.

**Commands:**

| Command | Rule |
|---|---|
| `loadList()` | `params === undefined` gives `{ '', 1 }`. Otherwise it is a no-op |
| `setQuery(k)` | `q = k.trim()`. If `q === ''`, the target is `{ '', 1 }` (Clear always means popular page 1). If `q` equals the current query and is not empty, it is a no-op and keeps the page. Otherwise `{ q, 1 }`. If the target equals the current params, do not `set` |
| `goToPage(p): boolean` | Returns `false` with no change when any of these hold: `params` is `undefined`, `loadingSignal()`, `errorSignal()`, `p` is not an integer, `p < 1`, `p > totalPagesSignal()`, or `p === pageSignal()`. Otherwise it sets `{ ...params, page: p }` and returns `true` |
| `reloadList()` | `list.reload()`, which retries the same query and page |

### `MoviePagination` (new: `src/app/movies/movie-pagination/`)

- **`page-window.ts`:** `export type PageItem = number | 'ellipsis'` and `export function pageWindow(current: number, total: number): PageItem[]`. The algorithm is exactly as in proposal §5.2 (`SIBLINGS = 1`, `SLOTS = 7`). It is pure.
- **`movie-pagination.ts` / `.html`:** standalone, with no injected services.
  - API: `currentPage = input.required<number>()`, `totalPages = input.required<number>()`, `disabled = input(false)`, `pageChange = output<number>()`.
  - It renders nothing when `totalPages() <= 1`.
  - Markup: `<nav aria-label="Pagination"><ul>` containing native `<button type="button">` elements:
    - "Previous" and "Next" have accessible names "Previous page" and "Next page", and are `disabled` at the ends or when `disabled()`;
    - each page button has `aria-label="Page N"`, and the current one has `aria-current="page"`;
    - every button is `disabled` while `disabled()`;
    - `ellipsis` renders as an `aria-hidden="true"` item.
  - It emits only pages in `1..totalPages` that differ from `currentPage`.
  - Styling: Tailwind, matching the existing restrained buttons, with visible `focus-visible` and no wrap on 360 px.

### `MovieList`

- **Pager:** render `<app-movie-pagination>` **below** the results region (outside the state `@if` chain) while `totalPagesSignal() > 1 && !errorSignal()`. Bind `[currentPage]="page()"`, `[totalPages]="totalPages()"` and `[disabled]="loading()"`.
- **Results region:** the existing wrapper that always exists gets `#results tabindex="-1"` and `focus:outline-none`.
- **Focus:** `onPageChange(p) { if (this.movieService.goToPage(p)) this.results().nativeElement.focus(); }`, using `viewChild.required`. This is an imperative call in the event handler, and focus moves **only** here. Nothing moves focus on initial load, search, Retry or Back.
- **Status line:** keep the T3 behaviour (silent on error). When loaded with `totalPages > 1`, it reads `Page X of Y. N movies shown.`; otherwise `N movies shown.`

## Transition Table

| # | Trigger | `params` after | Request | Pager |
|---|---|---|---|---|
| 1 | Service created (deep link `/movie/:id`) | `undefined` | none | — |
| 2 | First `loadList()` | `{'',1}` | popular p1 | absent until metadata arrives |
| 3 | `loadList()` on Back from details | unchanged | none | unchanged, same page and results |
| 4 | New non-empty query (debounced or submitted) | `{q,1}` | search q p1, cancels any in-flight request | absent until the new metadata arrives |
| 5 | Same non-empty query re-submitted | unchanged (keeps the page) | none | unchanged |
| 6 | Clear, empty or whitespace (with the pending timer cleared first, §9) | `{'',1}` | popular p1 unless already `{'',1}` | absent until metadata arrives |
| 7 | Clear when already `{'',1}` | unchanged | none | unchanged |
| 8 | Valid `goToPage(p)` | `{query,p}` | same mode, page p; any in-flight request is cancelled | visible, disabled while loading; focus moves to the results |
| 9 | `goToPage` invalid (`≤0`, `>total`, non-integer or NaN, same page, while loading, on error, before `loadList`) | unchanged | none | unchanged; returns `false` |
| 10 | Response with `total_pages > 500` | — | — | the pager tops out at 500; page 501+ is never requested |
| 11 | Error on any page | unchanged | — | hidden (`totalPages` is 0); the error with Retry shows |
| 12 | Retry | unchanged | the same query and page again | hidden while retrying; it appears on success; focus does not move |

## Tests (Developer-written and focused)

Follow the existing conventions: flush, then wait with `ApplicationRef.whenStable()`; `httpMock.verify()` runs in `afterEach`. The specs use the committed empty-token `environment.ts`.

- **`movie.service.spec.ts`:** update the existing method tests for the `TmdbPage` return type, keeping their intent. Add:
  - the `page` parameter for popular and search, defaulting to 1, with the full metadata returned;
  - `loadList` sends popular p1;
  - `goToPage(3)` sends page 3 of the current mode;
  - a new query resets to p1;
  - Clear from search p3 gives popular p1;
  - Clear from popular p3 with an uncommitted draft gives popular p1;
  - the same query on p3 sends no request and keeps p3;
  - the invalid `goToPage` cases send nothing and return `false`, including while loading, on error and before `loadList`;
  - `total_pages: 38029` gives `totalPagesSignal` 500, and `goToPage(501)` is rejected;
  - `totalPagesSignal` is kept during a same-query page load, is 0 after a query change until the response arrives, and is 0 on error;
  - a query change during a pending page request cancels it;
  - `reloadList` re-requests the same page.
- **`page-window.spec.ts`:** the proposal §5.2 fixture table, plus these invariants: length 7 when `total > 7`, ascending, first and last present, no adjacent ellipses, `total` of 0 or 1 handled.
- **`movie-pagination.spec.ts`:**
  - it renders nothing when `total ≤ 1`;
  - exactly one `aria-current="page"`;
  - Previous is disabled on page 1 and Next on the last page;
  - every button is disabled when `disabled`;
  - clicking a page or Next emits the right number, and clicking the current page emits nothing;
  - the `nav` has `aria-label`, and the ellipsis is `aria-hidden`.
- **`movie-list.spec.ts`:**
  - no pager when `total_pages: 1`;
  - the pager appears after `total_pages: 5`;
  - Next sends `page=2`, the pager stays visible and disabled while loading, and focus is on the results region;
  - the pager is absent on error;
  - the status line includes `Page 1 of 5`;
  - initial load and search do not move focus.
- **Navigation:** in the list or detail spec, using `RouterTestingHarness` with the app routes: popular → page 3 → `/movie/:id` → back to `/`. No new list request, and page 3, its results and the query are preserved. The existing deep-link test still shows no popular request.

## Validation

1. `npm test -- --watch=false` (the log line, files and counts).
2. `npm run lint`.
3. `npm run format:check`.
4. `npm run build` (the chunks).
5. `grep -rnE "effect\(|toSignal|toObservable|httpResource" src/app --include=*.ts` gives no matches. `grep -rn "linkedSignal" src/app` matches only `movie.service.ts`.
6. `grep -rn "PROBE\|SHAPE\|console\." src/app` gives no matches.
7. `git status --short` and `git diff --stat` show only the expected files. The human-owned file's `stat` is unchanged.

## Acceptance Criteria

1. The contract matches §22 and this handoff exactly: methods, `TMDB_MAX_PAGE`, `params`, signals and commands.
2. Every row of the transition table behaves as stated and has a test.
3. `MoviePagination` is presentation-only and accessible (`nav` label, native buttons, `aria-current`, disabled states), and renders the 7-slot window from a pure, tested `pageWindow`.
4. Same-query page loads keep the pager visible and disabled. On error, and before the first metadata, there is no pager. Page 501+ is never requested.
5. Focus moves to the results only on an accepted user page change.
6. The deep-link and Back invariants are proven by tests.
7. Tests, lint, format:check and build pass. Only the expected files changed, there are no dependencies, and the human-owned file is untouched.

## Expected Files

- **Modify:**
  - `src/app/movies/tmdb.ts`
  - `src/app/movies/movie.service.ts` and `movie.service.spec.ts`
  - `src/app/movies/movie-list/movie-list.ts`, `movie-list.html` and `movie-list.spec.ts`
- **Create:** `src/app/movies/movie-pagination/page-window.ts`, `page-window.spec.ts`, `movie-pagination.ts`, `movie-pagination.html` and `movie-pagination.spec.ts`.
- **Optional:** the navigation test may live in `src/app/movies/movie-detail/movie-detail.spec.ts` or `movie-list.spec.ts`.
- **Everything else is protected:** `MovieSearch`, `MovieDetail` source, `MovieCard`, routes, `app.config.ts`, the configuration files, `.claude/**` and the environment files.

## Stop Conditions

- **Resource semantics:** `rxResource` or `linkedSignal` behave differently from §22.3 in Angular 22.2.2, for example `hasValue()` during same-query loading, or the error/reload transitions. If keeping `totalPagesSignal` during loading would need an `effect()` or writable duplicated state, STOP and report it. Do not work around it.
- **Scope:** a criterion needs a file outside Expected Files, a `MovieSearch`/`MovieDetail` source change, a dependency, or URL state.
- **Security:** any step would touch `environment.local.ts`.
- **Review loop:** the same issue fails two review/fix cycles.

## Completion Report

Use the `developer.md` format. Also include the transition-table evidence (test name per row), the observed `totalPagesSignal` behaviour during same-query loading, and the human-owned file's `stat` before and after. Do not commit or push.

## Manual Browser Verification (HUMAN ONLY)

1. Run `npm run start:local`. Popular page 1 loads and the pager shows `1 2 3 4 5 … 500` (capped).
2. Click Next or 2. The skeleton shows, the pager stays and is disabled, focus moves to the results, and page 2 loads (DevTools: `page=2`).
3. Jump to 500. Next is disabled and no 501 is requested.
4. Search `star`. The search loads page 1 and the pager reflects the search's total. Go to page 2, then re-submit `star`: nothing is sent and you stay on page 2.
5. Clear (×). Popular page 1 appears at once. Repeat after typing without waiting 300 ms while on popular page 3: you get popular page 1.
6. On page 3, open a movie, then "Back to movies". You return to page 3 with the same results and no list request.
7. Refresh on `/movie/550`. There is no `movie/popular` request.
8. Go Offline and change page. The error and Retry show with no pager. Go back Online and press Retry: the same page loads.
9. Keyboard: Tab through the pager. Focus rings are visible, the current page is announced as current, and the disabled buttons are skipped or announced as disabled.
10. At 360 px the pager does not wrap awkwardly.
