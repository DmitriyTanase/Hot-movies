# HOT Movies — T6 Pagination Architecture Proposal

**Status: APPROVED 2026-10-15, with human amendments; recorded in architecture-proposal.md §22.** H4 was modified: keep the pager visible but disabled during same-query loading. Clear always goes to popular page 1. The Developer writes the focused tests.

- Prepared 2026-10-15 by the Architect agent. Nothing has been implemented.
- Base: T5 committed (`0246bff`).
- Authoritative requirements: `.claude/context/assignment.md`. The assignment does **not** mention pagination. T6 is a human-requested scope extension, and it reverses the Gate #1 line "No pagination" (architecture-proposal §0). See H1.
- Approved architecture: `.claude/docs/architecture-proposal.md`. This document does not rewrite it. §11 lists the targeted amendments it would need after approval.

---

## 1. Verified TMDb Pagination Behaviour

### 1.1 Documented facts (official sources, checked 2026-10-15)

| Fact | Source |
|---|---|
| `GET /3/movie/popular` takes `page` (integer int32, default `1`) plus `language` and `region`. The reference states no min or max. | https://developer.themoviedb.org/reference/movie-popular-list |
| `GET /3/search/movie` takes `page` (integer int32, default `1`), plus `query` (required), `include_adult`, `language`, `primary_release_year`, `region`, `year`. The reference states no min or max. | https://developer.themoviedb.org/reference/search-movie |
| Both 200 responses have `page: integer`, `results: object[]`, `total_pages: integer`, `total_results: integer`. | Same two pages |
| Popular's example response shows `total_pages: 38029` and `total_results: 760569`. This is sample data, but it shows that `total_pages` can be far larger than 500. | movie-popular-list |
| Error **code 22, HTTP 400**: "Invalid page: Pages start at 1 and max at 500. They are expected to be an integer." | https://developer.themoviedb.org/docs/errors |

### 1.2 Assumptions (not verified with a live request; no token was used)

- **A1:** the 500-page cap from the errors page applies to both `/movie/popular` and `/search/movie`. It is a generic error, not scoped per endpoint. Clamping to 500 is safe either way.
- **A2:** `total_pages` is not clamped by TMDb, so it can report more than 500. The example response suggests this.
- **A3:** `total_pages` can be `0` for a search with no results.
- **A4:** popular rankings change over time, so `total_pages` may differ between two requests. A page close to the reported end could come back with `results: []`.
- **A5:** one page holds about 20 results. The design does not depend on this.

### 1.3 Design consequence

**Usable maximum** = `min(total_pages, 500)`. The 500 lives in one constant, `TMDB_MAX_PAGE = 500` in `tmdb.ts`, with a comment citing error code 22. Neither the UI nor the service can request a page above the usable maximum, below 1, or that is not an integer. Code 22 therefore cannot be triggered from the UI. If it ever happens, a 400 maps to the existing generic error message plus Retry.

---

## 2. Current Architecture Elements T6 Affects

| Element | Current (T1–T5) | T6 impact |
|---|---|---|
| `getPopularMovies()` / `searchMovies(keyword)` | Hard-coded `page=1`. Return `Observable<Movie[]>` through `map(r => r.results)` | Take an optional `page`. Return the typed page (H2) |
| `TmdbPage<T>` (`movie.ts`) | Exists, used only internally | Becomes the list resource value type. No change to the type |
| `query = signal<string \| undefined>` | Single source of list state. `undefined` means idle | Replaced by `params = signal<ListParams \| undefined>` with `{ query, page }` |
| `rxResource` (`params` / `stream`) | Switches between popular and search | Same shape, and passes `page` through |
| `moviesSignal` | `value()` when `hasValue()` | Becomes `value().results` |
| `loadList` / `setQuery` / `reloadList` | Three commands | Kept. `setQuery` resets to page 1 and gets an explicit same-query guard. `goToPage` is added |
| `MovieList` | Search, live line, error / skeleton / empty / grid | Renders `<app-movie-pagination>` below the grid. Moves focus on page change. The live line includes the page |
| `MovieSearch` | 300 ms timer, submit, clear | **Unchanged.** It still calls only `setQuery` |
| `MovieDetail`, `MovieCard`, routes, `app.config.ts`, `error-message.ts` | | **Unchanged** |
| Arch §2.6 resource semantics | Param change aborts in-flight; `loading` clears value; `reload()` reuses params | Relied on unchanged. `reload()` re-requests the **current page** |
| Arch §7 idle-until-`loadList` | Deep link sends no popular request | Preserved: `params` still starts `undefined` |
| Arch §9 dedupe ("same query → no request") | Default signal equality on a string | Now an **explicit guard** in `setQuery`, because the params are an object |
| Tests | `whenStable` does not resolve while a request is pending, so flush first. `page()` helpers already return a `TmdbPage` shape with `total_pages: 1` | Service HTTP-method tests change their expected result type |

---

## 3. API / DTO Contract

```ts
// movie.service.ts — required methods (names kept; page is optional, so the assignment's call signatures still work)
getPopularMovies(page = 1): Observable<TmdbPage<Movie>>
searchMovies(keyword: string, page = 1): Observable<TmdbPage<Movie>>
getMovieDetails(id: number): Observable<MovieDetails>   // unchanged
```

- **Same requests otherwise:** the same URLs, headers, `language=en-US` and `include_adult=false`. Only `page` becomes variable.
- **Unchanged properties:** the methods stay cold, typed, cancellable and stateless.
- **The `map(r => r.results)` is removed.** The resource needs `total_pages`.
- **`TmdbPage<T>` is used as is:** `{ page; results: T[]; total_pages; total_results }` (already in `movie.ts`). There is no app-level paginated type.

**Why `TmdbPage<Movie>` directly and not a new `MoviePage` type:**

- Arch §12 already chose 1:1 TMDb typing with no mapping layer. A `MoviePage { movies; totalPages }` would be a second type for the same data.
- Its only "logic" would be the 500 clamp. That is one `Math.min` in a `computed`.
- `total_results` is carried in the type but not used by the UI. It is not worth a mapping step to drop it.

Alternatives are in H2.

---

## 4. Signal / Resource State Model

```ts
// tmdb.ts
/** TMDb rejects page > 500 (error code 22, developer.themoviedb.org/docs/errors). */
export const TMDB_MAX_PAGE = 500;

// movie.service.ts (sketch)
interface ListParams { query: string; page: number } // query '' = popular

// undefined = list not requested yet -> resource idle -> no HTTP (Arch §7, unchanged)
private readonly params = signal<ListParams | undefined>(undefined);

private readonly list = rxResource({
  params: () => this.params(),
  stream: ({ params: { query, page } }) =>
    query ? this.searchMovies(query, page) : this.getPopularMovies(page),
});

readonly querySignal      = computed(() => this.params()?.query ?? '');
readonly pageSignal       = computed(() => this.params()?.page ?? 1);
readonly moviesSignal     = computed(() => (this.list.hasValue() ? this.list.value().results : []));
readonly totalPagesSignal = computed(() =>
  this.list.hasValue() ? Math.min(this.list.value().total_pages, TMDB_MAX_PAGE) : 0);
readonly loadingSignal    = this.list.isLoading;
readonly errorSignal      = /* unchanged */;

loadList(): void {
  if (this.params() === undefined) this.params.set({ query: '', page: 1 });
}
setQuery(keyword: string): void {
  const query = keyword.trim();
  if (this.params()?.query === query) return;          // same effective query: no request, page kept
  this.params.set({ query, page: 1 });                 // new query (or clear) -> page 1
}
goToPage(page: number): void {
  const current = this.params();
  if (!current || !Number.isInteger(page) || page < 1 ||
      page > this.totalPagesSignal() || page === current.page) return;  // invalid: no request
  this.params.set({ ...current, page });
}
reloadList(): void { this.list.reload(); }              // Retry: same query, same page
```

### 4.1 Why one composite signal with guards

| Option | Assessment |
|---|---|
| **A. One `signal<ListParams \| undefined>`, default equality, explicit guards in the commands (chosen)** | Every write is atomic, with query and page changing together, so no intermediate `{newQuery, oldPage}` state exists. Dedupe sits in plain `if`s that read like the transition table (§6). "Idle" stays one `undefined` value. |
| B. The same signal with a custom `equal` | `setQuery('bat')` while on `{bat, 3}` must be a no-op, but `{bat, 1}` is not equal to `{bat, 3}`. The guard is needed anyway, so `equal` would be redundant and hides intent. |
| C. Two signals (`query`, `page`) plus `params: () => ({ query: query(), page: page() })` | It works, because primitive equality dedupes and the computed is read lazily. But a new query needs two `set`s whose correctness depends on batching, and "idle" must be represented in one of them. More moving parts for no gain. |

### 4.2 Derived values and loading

- **Current page:** the *requested* page (`params().page`) is shown, not the response's `page`. It is known immediately and cannot disagree with the request.
- **`totalPagesSignal` is 0 while loading or in error,** because `loading` clears `value()`. This is deliberate (H4):
  - the pager is shown only in the loaded state;
  - `goToPage` rejects everything while the total is unknown.
- **No stale total is kept.** The design needs no `linkedSignal` and has no risk of showing the previous query's total for a new query.
- **Not used:** `effect()`, `toSignal` and `toObservable`. `rxResource` remains the only Signals↔RxJS bridge.

### 4.3 Lifecycle

- **Root service, app lifetime:** query, page and the last result therefore survive navigation to the details page and back.
- **No refetch on return:** `loadList()` is a no-op once `params` is set.

---

## 5. `MoviePagination` Component and Window Algorithm

### 5.1 API (presentation-only)

```ts
// src/app/movies/movie-pagination/movie-pagination.ts
@Component({ selector: 'app-movie-pagination', templateUrl: './movie-pagination.html', host: { class: 'block' } })
export class MoviePagination {
  readonly currentPage = input.required<number>();
  readonly totalPages  = input.required<number>();
  readonly pageChange  = output<number>();           // emits only valid, different pages
  protected readonly items = computed(() => pageWindow(this.currentPage(), this.totalPages()));
  protected select(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) this.pageChange.emit(page);
  }
}
```

- **No dependencies:** no `MovieService`, HTTP, TMDb or query knowledge, and no injected dependencies at all.
- **Output name:** `pageChange`, not `currentPageChange`. The latter would read as a two-way `model()` binding, and the parent does not own the value.

### 5.2 Window algorithm (pure function)

The function lives in `src/app/movies/movie-pagination/page-window.ts`.

```ts
export type PageItem = number | 'ellipsis';
const SIBLINGS = 1;                 // H5: pages on each side of the current page
const SLOTS = 2 * SIBLINGS + 5;     // first + gap + window + gap + last = 7

/** Precondition: total >= 0; 1 <= current <= max(total, 1). */
export function pageWindow(current: number, total: number): PageItem[] {
  if (total <= SLOTS) return range(1, total);                               // all pages, no ellipsis
  if (current <= SIBLINGS + 3) return [...range(1, SLOTS - 2), 'ellipsis', total];              // near start
  if (current >= total - SIBLINGS - 2) return [1, 'ellipsis', ...range(total - SLOTS + 3, total)]; // near end
  return [1, 'ellipsis', ...range(current - SIBLINGS, current + SIBLINGS), 'ellipsis', total];
}
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
```

**Properties:**

- **Fixed length:** when `total > SLOTS`, the result always has exactly 7 items, so the pager width stays stable.
- **No one-page gaps:** an ellipsis always hides at least 2 pages. A lone hidden page is shown as itself.
- **Endpoints always visible:** the first and last pages always appear.
- **Deterministic:** no DOM or width measurement.

**Expected outputs (QA fixtures):**

| current / total | Output |
|---|---|
| 1 / 0 | `[]` |
| 1 / 1 | `[1]` |
| 3 / 7 | `1 2 3 4 5 6 7` |
| 1 / 10 | `1 2 3 4 5 … 10` |
| 4 / 10 | `1 2 3 4 5 … 10` |
| 5 / 10 | `1 … 4 5 6 … 10` |
| 6 / 10 | `1 … 5 6 7 … 10` |
| 7 / 10 | `1 … 6 7 8 9 10` |
| 10 / 10 | `1 … 6 7 8 9 10` |
| 10 / 500 | `1 … 9 10 11 … 500` |
| 500 / 500 | `1 … 496 497 498 499 500` |

With `SIBLINGS = 2` (9 slots), 10 / 500 becomes `1 … 8 9 10 11 12 … 500`.

### 5.3 Template and accessibility

- **Rendering:** the pager is rendered only when `totalPages() > 1` (`@if` inside the component).
- **Structure:** `<nav aria-label="Pagination"><ul class="flex …">` with each item in an `<li>`. Lists announce item counts.
- **Native `<button type="button">` everywhere, not links.** There is no URL state (H6), and a link without `href` is not a link.
- **Previous / Next:**
  - visible text "Previous" / "Next" (or an arrow plus visually-hidden text);
  - accessible names "Previous page" / "Next page";
  - native `disabled` on page 1 and on the last page.
- **Page buttons:**
  - visible number, `aria-label="Page N"`;
  - the current page has `aria-current="page"` and a distinct style;
  - the current page stays a focusable button (`select` ignores it), so focus order and `aria-current` stay discoverable.
- **Ellipsis:** `<li aria-hidden="true">…</li>`. It is not focusable.
- **Keyboard:** native Tab, Enter and Space. Visible `focus-visible` rings, as elsewhere.
- **Tracking:** `@for (item of items(); track $index)`, because the two ellipses need distinct keys.

### 5.4 Placement in `MovieList`

- **Position:** below the grid, inside the non-loading, non-error branch. It is shown whether or not `movies().length === 0`, so an empty last page (A4) still offers navigation. The component itself hides when `totalPages <= 1`.
- **`MovieList` binding:** `[currentPage]="page()" [totalPages]="totalPages()" (pageChange)="goToPage($event)"`.
- **Focus and scroll (H7):** the existing results wrapper gets `#results tabindex="-1"` (programmatic focus target, `focus:outline-none`). The handler is:

  ```ts
  goToPage(p) { this.movieService.goToPage(p); this.results().nativeElement.focus(); }
  ```

  Focus scrolls the list top into view and replaces the focus that would otherwise drop to `<body>` when the pager unmounts during loading. This is an imperative DOM call in an event handler, not an `effect()`.
- **Live line:** when `totalPages() > 1`, the existing `aria-live` text becomes `Page 3 of 500. 20 movies shown.`

---

## 6. Search / Page Transition Rules

`S` is the current `params`. `T` is `totalPagesSignal()`, which is 0 unless loaded.

| # | Trigger | Precondition | New `params` | Request |
|---|---|---|---|---|
| 1 | Service constructed (for example a deep link to `/movie/:id`) | | `undefined` (idle) | **None** |
| 2 | `MovieList` created → `loadList()` | `S` undefined | `{ '', 1 }` | popular p1 |
| 3 | `loadList()` (Back from details) | `S` defined | unchanged | **None.** Query, page and results are shown from cache |
| 4 | Debounced input / Submit with a new effective query `q` | `trim(q) ≠ S.query` | `{ q, 1 }` | search `q` p1. An in-flight request is aborted |
| 5 | Submit / debounce with the same effective query | `trim(q) = S.query` (also after an error) | unchanged, **page kept** | **None** (H3). Retry is the error path |
| 6 | Clear (x), or the field is emptied or whitespace-only | `S.query ≠ ''` | `{ '', 1 }` | popular p1. An in-flight request is aborted |
| 7 | Clear while already on popular | `S.query = ''` | unchanged (page kept) | **None.** Same rule as #5 |
| 8 | Pager emits `p` | loaded, integer, `1 ≤ p ≤ T`, `p ≠ S.page` | `{ S.query, p }` | same mode, page `p` |
| 9 | `goToPage(p)` with `p ≤ 0`, `p > T`, a non-integer, `NaN`, or `p = S.page` | | unchanged | **None** |
| 10 | `goToPage(p)` while loading or in error (`T = 0`) | | unchanged | **None.** The pager is not rendered then |
| 11 | `goToPage(p)` before `loadList()` | `S` undefined | unchanged | **None** |
| 12 | New query or clear while a page request is in flight | #4 / #6 preconditions | `{ q, 1 }` | old request `cancelled`, new request sent |
| 13 | Retry (`reloadList()`) after an error on page `n` | | unchanged | same mode, page `n` |
| 14 | `total_pages > 500` | | | Pager max = 500. Page 501+ cannot be requested |
| 15 | Response has `total_pages` ≤ 1 (including 0) | | | Pager hidden. The empty-state text is unchanged |
| 16 | `MovieSearch` destroyed while the debounce is pending | | unchanged | **None** (existing `DestroyRef` clear) |

---

## 7. Testing Strategy

QA owns all spec files. Existing conventions apply:

- `TestBed.tick()` to start the resource, flush, then `await ApplicationRef.whenStable()`;
- never await `whenStable` or a harness navigation while a request is pending;
- `httpMock.verify()` in `afterEach`;
- the committed empty-token `environment.ts` only.

| Target | Behaviour protected |
|---|---|
| `MovieService` HTTP methods (update existing) | Default `page=1` for both methods. `getPopularMovies(3)` / `searchMovies('x', 3)` send `page=3`. The result is the whole `TmdbPage` (`page`, `results`, `total_pages`, `total_results`). Headers and other params are unchanged |
| `MovieService` list state (extend) | **Lifecycle:** idle with no request; `pageSignal()` is 1 and `totalPagesSignal()` is 0. `loadList()` sends popular p1. After loading `{ total_pages: 5 }`: `totalPagesSignal()` is 5 and `pageSignal()` is 1.<br>**Paging:** `goToPage(2)` sends popular `page=2` and the results are replaced.<br>**Query changes:** on page 3, `setQuery('bat')` sends search `page=1`; clear sends popular `page=1`. On search page 3, re-submitting `'bat'` / `'bat '` sends no request and the page stays 3.<br>**Invalid `goToPage`:** `0`, `-1`, `2.5`, `NaN`, `6` (above total) and the current page send **no** request (`expectNone`). `goToPage` before `loadList` and during loading send no request.<br>**Clamp and cancel:** `total_pages: 38029` gives `totalPagesSignal()` 500, and `goToPage(501)` sends nothing. A query change while a page-2 request is pending sets `cancelled === true` on it, and only the newest results are shown.<br>**Errors:** Retry after an error on page 3 re-sends `page=3`. A 400 response maps to the generic message |
| `pageWindow` (new, pure) | The §5.2 fixture table. The length is always 7 when `total > 7`. Output is ascending. No adjacent duplicates. The first and last pages are present |
| `MoviePagination` (new) | Hidden when total is 0 or 1. `nav[aria-label="Pagination"]` exists. The current button has `aria-current="page"` and only one does. Previous is disabled on page 1 and Next on the last page. Clicking Previous, Next or a number emits the correct page; clicking the current page emits nothing. The ellipsis is `aria-hidden`. Every control is a native `button` |
| `MovieList` (extend) | No pager when `total_pages: 1`. The pager appears after loading `total_pages: 5`. Clicking "Next" sends `page=2`, shows the skeleton, hides the pager, and moves focus to the results container. The pager is absent in the error state. An empty page with `total > 1` still shows the pager. The live line includes "Page 1 of 5" |
| Navigation integration (new, `RouterTestingHarness`, real `routes`) | `/` loads p1; go to p3 and flush. Navigate to `/movie/1` and flush details. Navigate to `/` → **no** list request (`expectNone` on popular and search). The page-3 cards render, the pager shows `aria-current` on 3, and the search input shows the query (do the same once with a search query) |
| Deep link (existing, keep) | `/movie/1` sends exactly one request and no popular request. It must still pass unchanged |
| `MovieSearch`, `MovieCard`, `MovieDetail`, `errorMessage` | Unchanged and must pass unchanged |

Static checks: `npm run build`, `npm test -- --watch=false` (authoritative, must log `vitest-base.config.mjs`), `npm run lint`, `npm run format:check`.

---

## 8. Expected Files Changed

**Developer:**

| File | Change |
|---|---|
| `src/app/movies/tmdb.ts` | Add `TMDB_MAX_PAGE = 500` with a citation comment |
| `src/app/movies/movie.service.ts` | `page` params, `TmdbPage` returns, `params` signal, `pageSignal`, `totalPagesSignal`, `goToPage`, guarded `setQuery` |
| `src/app/movies/movie-pagination/page-window.ts` | **New** pure function |
| `src/app/movies/movie-pagination/movie-pagination.ts` + `.html` | **New** presentational component |
| `src/app/movies/movie-list/movie-list.ts` + `.html` | Render the pager, page and total signals, focus the results container, live-line text |

**QA:**

| File | Change |
|---|---|
| `src/app/movies/movie.service.spec.ts` | Update and extend |
| `src/app/movies/movie-list/movie-list.spec.ts` | Extend |
| `src/app/movies/movie-pagination/page-window.spec.ts` | **New** |
| `src/app/movies/movie-pagination/movie-pagination.spec.ts` | **New** |
| `src/app/movies/list-navigation.spec.ts` | **New**; alternatively a `describe` in `movie-list.spec.ts`, QA's choice |

**Architect, after approval:** `.claude/docs/architecture-proposal.md` (amendments in §11) and `.claude/context/task-handoff.md` (T6 handoff).

**Optional, human's choice:** one README line under Features.

**Not touched:**

- `movie.ts`, `error-message.ts`;
- `movie-search/*`, `movie-card/*`, `movie-detail/*`;
- `app.routes.ts`, `app.config.ts`, `angular.json`, `package.json`;
- environment files.

---

## 9. Decisions Requiring Human Approval

| # | Decision | Options | Trade-offs | Recommendation |
|---|---|---|---|---|
| **H1** | Scope: add pagination, reversing Gate #1 "No pagination" | (a) Approve T6 as an additive extension. (b) Keep "no pagination" | (a) is a modest UI and state change that is fully contained in the list feature. It is not required by the assignment. (b) needs no work | **(a)**, recorded in §0 as a human-approved extension |
| **H2** | Contract of the required methods | **A.** `getPopularMovies(page = 1)` / `searchMovies(keyword, page = 1)` return `Observable<TmdbPage<Movie>>`.<br>**B.** Keep `Observable<Movie[]>` and add `getPopularPage` / `searchPage` methods for the resource.<br>**C.** Return an app-level `MoviePage { movies, page, totalPages }` that is mapped and clamped | A: one method per operation; arguments are optional, so the assignment's call signatures still compile. The return type now includes metadata.<br>B: duplicate methods, and the resource would no longer use the required methods (contradicts Arch §5.3).<br>C: a second type and a mapping step, contradicting Arch §12 | **A** |
| **H3** | Re-submitting the same effective query (also Clear while on popular) | (a) No-op: page kept, no request. (b) Reset to page 1 and refetch | (a) is consistent with the existing dedupe rule and keeps debounced trailing-space edits harmless.<br>(b) "Search starts over" may match some users' expectations, but it means a duplicate request and `'bat'` → `'bat '` would silently jump back to page 1 | **(a)** |
| **H4** | Pager during loading and error | (a) Hidden; `totalPages` is 0, so `goToPage` is rejected. (b) Keep the last known total (a `linkedSignal` reset on query change) and show the pager disabled or enabled while loading | (a): no stale-state logic, and the skeleton replaces both the grid and the pager. You cannot page from an error state; Retry or a new query is the path.<br>(b): a stable layout, at the cost of a `linkedSignal`, reset rules and a stale-total risk | **(a)** |
| **H5** | Window size | (a) `SIBLINGS = 1` (7 slots + Previous/Next ≈ 9 buttons). (b) `SIBLINGS = 2` (9 slots ≈ 11 buttons, matches the `1 … 8 9 [10] 11 12 … 500` example) | (a) fits a 320–360 px viewport without wrapping or responsive variants. (b) likely wraps on small phones | **(a)**, one constant |
| **H6** | URL synchronisation (`?q=&page=`) | (a) None; service state only (Gate #1 already says "No URL-synchronized search state"). (b) Router query params as the source of truth | (b) gives shareable and refreshable URLs and browser Back between pages. But the router would own the state, conflicting with the assignment's service-owned signals and with idle-until-`loadList`, and every search keystroke would become a navigation (`replaceUrl` policy). That is a much larger change | **(a)** |
| **H7** | Focus and scroll on page change | (a) Focus the results container (`tabindex="-1"`), which also scrolls it into view. (b) Only `window.scrollTo({ top: 0 })`. (c) Nothing | (a) solves both the scroll problem and focus loss when the pager unmounts. (b) scrolls, but focus drops to `<body>`. (c) leaves the user at the bottom of a skeleton grid | **(a)** |

---

## 10. Complexity Deliberately Rejected

- **Not in the brief:** infinite scroll and "load more".
- **No third-party code:** no pagination or UI library, and no state library.
- **No URL or router state** for query or page (H6). Browser Back is not used for page history.
- **No stale-total `linkedSignal`** or "previous value" caching (H4). No `effect()`, `toSignal` or `toObservable`.
- **No custom signal `equal`.** Explicit guards are clearer (§4.1).
- **No app-level paginated model or DTO mapping** (H2-C).
- **No responsive window sizes, width measurement or page-jump input.**
- **No prefetching** of adjacent pages and **no page cache.** Revisiting a page refetches it, which is consistent with the existing "no cache except the current result" rule.
- **No changes outside the list feature:** no change to the `MovieSearch` debounce, to `MovieDetail` behaviour or to credentials.
- **No pager while loading or in error,** and no top-and-bottom duplicate pager.
- **No generic shared "Paginator".** It lives under `movies/` until reuse is real.
- **No runtime validation** of `total_pages`. The clamp plus guards make out-of-range requests impossible.

---

## 11. Targeted Amendments to `.claude/docs/architecture-proposal.md` (after approval)

| Section | Amendment |
|---|---|
| Header / §0 | Add "Gate #2 (T6), <date>". Replace "No pagination." with "Numbered pagination (T6, human-approved extension): service-owned `{query, page}`, presentational `MoviePagination`, max page 500". Keep "No URL-synchronized search state" and extend it to page. Record H2–H7 outcomes |
| §1 | Note that pagination is a human-approved extension beyond the assignment |
| §2.6 | Add: `reload()` re-runs the loader with the current params, so Retry targets the current page. Params are compared by reference, so the commands must not write equal-content objects (handled by the guards) |
| §2.7 / §12 | Add the TMDb page facts and code 22 with URLs. Add `TMDB_MAX_PAGE` in `tmdb.ts`. `TmdbPage<Movie>` is returned directly; `total_pages` is clamped in `totalPagesSignal` |
| §5.1 | Table: `getPopularMovies(page = 1)` / `searchMovies(keyword, page = 1)` with `&page={page}`, returning `Observable<TmdbPage<Movie>>`. The `map(r => r.results)` is removed |
| §5.2 | Replace the code with the §4 sketch (`params`, `pageSignal`, `totalPagesSignal`, `goToPage`, guarded `setQuery`) |
| §5.3 | Change "three small commands" to four (`loadList`, `setQuery`, `goToPage`, `reloadList`) |
| §6 | Change the "Committed list query" row to "Committed list params `{query, page}`". Add a derived total-pages row (from the resource, clamped, 0 unless loaded) |
| §7 | `loadList()` sets `{ query: '', page: 1 }`. The idle-until-`loadList` reasoning is unchanged |
| §8 | Add a row: page window → pure function plus `computed`. Add a note that focus-on-page-change is an imperative call in an event handler (no `effect`) |
| §9 | New query → page 1. The same-query guard keeps the page (H3) and is now explicit, not signal equality. Add "Loading during paging". Reference the §6 transition table |
| §10 | Add a `MoviePagination` row (inputs `currentPage` / `totalPages`, output `pageChange`, buttons, `aria-current`). The `MovieList` row now renders the pager and focuses the results on page change |
| §11 | Add a note: paging is not a navigation. Browser Back leaves the list rather than going to the previous page; this is accepted (H6) |
| §14 | Add a pager row: hidden while loading or in error and when total ≤ 1; shown on an empty page when total > 1 |
| §16 | Add decisions H2–H7 |
| §17 | Add the §7 rows: service paging, `pageWindow`, `MoviePagination`, navigation integration |
| §18 | Add risks: popular `total_pages` drift (an empty last page is mitigated because the pager stays visible); the required-method return type change breaks the existing method tests (QA updates them); the 500 cap is assumed for search (A1) |
| §19 | Add defenses: why buttons and not links; why there is no URL sync; why 500; why one params signal; why the pager is hidden while loading |
| §20 / §21 | Update the open items and confidence |

---

## 12. Risks

1. **The 500 cap for `/search/movie` is inferred** from a generic error code (A1). If search allows fewer pages, `total_pages` already bounds it. If it allows more, we under-offer, which is safe.
2. **Popular `total_pages` drift (A4):** a far page may come back empty or with a smaller total. The pager stays visible on an empty page, and the clamp is recomputed from each response, so a page above the new total cannot be requested afterwards.
3. **Existing method tests change** because the return type changes (H2). QA must update them deliberately, not loosen assertions.
4. **Focus management:** `focus()` on a `tabindex="-1"` container must not show a ring for mouse users and must not trap focus. Verify manually with a keyboard and a screen reader.
5. **Skeleton flash on every page change** (Arch §18.8) is extended to paging. Accepted.

## 13. Confidence

- **High:** the state model, transition rules, the deep-link and Back preservation, and the window algorithm.
- **Medium-High:** the TMDb 500 cap for search (documented generically, not per endpoint) and the drift behaviour (A4), neither of which was verified with a live request.
