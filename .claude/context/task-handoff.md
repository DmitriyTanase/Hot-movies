# Task Handoff — T4: Movie Details, Detail Routing, and MovieCard Navigation

- **Architecture:** `.claude/docs/architecture-proposal.md` (APPROVED — Gate #1). The sections that apply:
  - 3 — Back: `routerLink="/"`;
  - 6 — details state is page-scoped;
  - 7 — deep link sends no popular request;
  - 8;
  - 10 — the `MovieCard` and `MovieDetail` rows are authoritative;
  - 11 — routing and router options;
  - 12 — `errorMessage`, 404;
  - 14 — states and missing data;
  - 15 — `withInMemoryScrolling` and `withComponentInputBinding` are kept;
  - 16 — D4;
  - 17 — the deep-link, `MovieCard` and `MovieDetail` rows.
- **Requirements:** `.claude/context/assignment.md`:
  - section 2: a click on a card opens the details page through routing;
  - section 4 (Детальная страница): title, poster, overview, genres, rating and release date; Angular Router; a "Back" button is desirable;
  - section 5.
- **T3 sequencing clarification** (human, T3 Resolved Decision 6): the whole-card link to `/movie/:id` (§10) is added in **this** task, together with the real detail route.
- **Existing contract. Use it as is and do not modify it:**
  - `MovieService.getMovieDetails(id: number): Observable<MovieDetails>`, which is stateless;
  - `MovieDetails` in `movie.ts`: `Movie` plus `genres: { id; name }[]`;
  - `posterUrl(path, 'w342' | 'w500')`;
  - `errorMessage(err)`: 401, then 404 "Movie not found.", then 0, then the generic message.
- **Owner:** Developer.

---

## Goal

Add the routed `MovieDetail` page, which holds its own state through `getMovieDetails(id)`. Wire `/movie/:id` and the deferred router options. Turn `MovieCard` into a real, keyboard-usable link to that page. Do not commit.

## Human-Owned Local File (carried forward)

`src/environments/environment.local.ts` holds the human's real token. Agents must **not**:

- read, open, `cat`, `grep`, Glob into, hash, copy, move, overwrite or delete it;
- run `npm run start:local`, `--configuration local` or `--build-target=…:local`;
- search `dist/` or `.angular/`.

Limit recursive searches to `src/app`. Only `ls`, `stat -c '%s %Y'`, `git check-ignore` and `git status` are allowed on it. The real-token browser checks are human-only.

## Preconditions

- `git status` is clean, apart from this handoff file. T3 is committed (`262a23a`).
- `npm run build`, `npm test -- --watch=false`, `npm run lint` and `npm run format:check` pass. If any fails, STOP.
- The test run logs `Using Vitest configuration file: …vitest-base.config.mjs`. `npm test -- --watch=false` is the authoritative test path; use no one-off runner configs or flags. If results ever look stale, STOP and report.
- Record `stat -c '%s %Y' src/environments/environment.local.ts` (metadata only).

## In Scope

1. **`MovieDetail`:** `src/app/movies/movie-detail/movie-detail.{ts,html,spec.ts}`.
2. **Routes:** add `{ path: 'movie/:id', title: 'Movie details', loadComponent: () => import('./movies/movie-detail/movie-detail').then(m => m.MovieDetail) }` between `''` and `'**'` (§11). The `''` and `'**'` routes stay unchanged.
3. **`app.config.ts`:** `provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))` (§11; deferred from T3). Nothing else.
4. **`MovieCard` navigation and affordances** (see MovieCard Interaction).
5. **Focused specs** (see Tests), and updates to the existing specs that the card change breaks.

## Out of Scope

- **Features:** pagination, URL-synchronized search, cast/crew, trailers, recommendations, similar movies, favorites, watchlists, authentication, extra TMDb endpoints, SSR.
- **State and dependencies:** NgRx, SignalStore, any state abstraction, new dependencies.
- **Data layer:** changes to `MovieService` or other T2 files, and detail state in `MovieService`.
- **Signal patterns:** `effect()`, `toSignal`, `toObservable`, `linkedSignal`, `httpResource`.
- **Other code:** `MovieList`/`MovieSearch` changes, apart from test setup that the card link needs. Changing Retry focus behaviour. Unrelated visual redesign or refactoring.
- **Files:** `README.md`, `angular.json`, `package.json`, `vitest-base.config.mjs`, environment files.
- **Card content:** no rating or year on the card.

## MovieDetail Responsibilities and State Ownership (§6, §10, D4)

- **Route id:** `id = input.required<string>()`, bound by `withComponentInputBinding`.
- **Id validation:** `validId = computed(() => …)` returns the parsed id if it is a positive integer (`/^\d+$/`, `> 0`), otherwise `undefined`.
- **Component-local resource:**

  ```ts
  rxResource({
    params: () => validId(),
    stream: ({ params }) => movieService.getMovieDetails(params),
  })
  ```

  - This is the only details state. It is created and destroyed with the route activation. Changing the id aborts the in-flight request.
  - Nothing is added to `MovieService`. Use no `effect()` and no subscriptions.
- **States,** using `@switch` on the resource status (or the equivalent `@if` chain), with the `hasValue()` guard before reading `value()`:

  | State | Renders |
  |---|---|
  | Invalid id (`validId()` is `undefined`, so the resource is idle and sends no request) | "Invalid movie id" and Back |
  | Loading | A skeleton block with `aria-busy="true"` |
  | Error | `errorMessage(error)` (a 404 shows "Movie not found.") in a `role="alert"` panel, a Retry button that calls `resource.reload()`, and Back |
  | Success | The title, the poster or placeholder, the overview, the genres, the rating, the release date, and Back |

- **Success fields:**

  | Field | Renders | When the data is missing |
  |---|---|---|
  | Title | An `<h2>` | — |
  | Poster | `posterUrl(poster_path, 'w500')` with `alt` = title | The same 2:3 "No poster" placeholder style as the card |
  | Overview | The overview text | "No description available." |
  | Genres | A chip list (`@for … track g.id`); the row is always visible | "No genres listed." when the array is empty (Resolved Decision 7) |
  | Rating | `vote_average` formatted as `x.x / 10` (`DecimalPipe` `'1.1-1'`) | "Not rated" when `vote_count === 0` |
  | Release date | `DatePipe` with the default format (en-US) | "Unknown" when `release_date` is empty |

- **Back:** `<a routerLink="/">Back to movies</a>` (§3, Resolved Decision 8). Because the list state lives in the root service, the previous query and results reappear with no refetch. Do not add `Location.back()`, router history logic, custom scroll persistence, or navigation state for scroll position.
- **Binding chain (do not replace it with `ActivatedRoute` parameter handling):** route `movie/:id` → `withComponentInputBinding()` → `id = input.required<string>()` → `validId` → the local `rxResource` → `MovieService.getMovieDetails(id)`.
- **Layout (§14):** stacked on mobile; from `md:`, the poster sits beside the text.

## Routing and Navigation Behaviour

- **Deep link:** a direct load of `/movie/:id` sends exactly **one** request, to `movie/{id}`, and **none** to `movie/popular`. `MovieList` is not activated, so `loadList()` is never called (§7).
- **Scroll:** with `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`, forward navigation goes to the top and browser Back restores the list position (§11).

## MovieCard Interaction (§10, plus the human's T3 browser-review request)

- **The whole card is one link:**
  - `<a [routerLink]="['/movie', movie().id]">` wraps the existing content: poster or placeholder, title, overview;
  - import `RouterLink`;
  - no `(click)` navigation and no `tabindex` (the native `<a>` is focusable);
  - content is unchanged, with no rating or year.
- **Restrained affordances:**
  - `cursor-pointer`;
  - hover: a slightly stronger shadow plus a small lift (for example `hover:shadow-lg hover:-translate-y-0.5`) with a short `transition`;
  - `focus-visible` outline or ring, at least as visible as the hover state;
  - no scaling and no other animation.
- **Semantics:** keep `<article>` for the content inside the `<a>`, or put the classes on the `<a>` with the `<article>` inside. Either way there is exactly one interactive element per card.

## Tests (Developer-written and focused; QA validates independently later)

**Tools:**

- `provideHttpClient()` together with `provideHttpClientTesting()` and `HttpTestingController` (the real `MovieService`);
- `provideRouter(routes, withComponentInputBinding())` and `RouterTestingHarness`, so the route→input binding is exercised;
- flush, then wait with `await …whenStable()`, as T3 established. `whenStable` does not resolve while a request is pending.

Specs use the committed empty-token `environment.ts`.

- **`movie-detail.spec.ts`:**
  - navigating to `/movie/42` sends one GET to `…/movie/42` with `language=en-US`, and **no** `movie/popular` request;
  - the loading skeleton shows while the request is pending;
  - on success it renders the title, the poster `w500` `src` and `alt` (and the placeholder when `poster_path` is `null`), the overview (and its fallback), the genre names (and "No genres listed." when empty), the rating (`7.5 / 10`, and "Not rated" when `vote_count` is 0), the formatted release date (and "Unknown" when it is empty), and a Back link with `href="/"`;
  - a 404 shows "Movie not found." with Retry and Back;
  - a 500 shows the generic message, and Retry sends the request again, then succeeds;
  - `/movie/abc` and `/movie/0` send no request and show "Invalid movie id" and Back.
- **Routes** (`app.routes` used through the harness or by checking the config):
  - `movie/:id` lazy-loads `MovieDetail` with the title `'Movie details'`;
  - `''` still loads `MovieList`;
  - unknown paths redirect to `''`.
- **`movie-card.spec.ts`:** replace the T3 "non-interactive article" test. The card renders one `<a>` with `href="/movie/{id}"` containing the poster, title and overview. The other T3 card tests stay.
- **`movie-list.spec.ts`:** add `provideRouter([])` if the card's `RouterLink` needs it. Change no assertions.

Do not add tests only to increase coverage.

## Manual Browser Verification (HUMAN ONLY; the Developer documents it and does not run it)

1. Run `npm run start:local`. The popular list loads.
2. Hovering a card shows a pointer cursor and a subtle lift or shadow.
3. Tab reaches the movie cards after the search controls.
4. A focused card shows a visible focus indicator.
5. Enter on a focused card opens `/movie/{id}`.
6. Clicking a card opens the same details page, scrolled to the top.
7. The details page shows the title, poster, overview, genres, rating (`x.x / 10`) and release date.
8. "Back to movies" returns to the list with the previous query and results, and no new list request (DevTools → Network). The exact previous scroll position is not required; the browser's own Back may behave differently.
9. Refreshing the browser on a known `/movie/{id}` (for example `/movie/550`) loads the details.
10. On that direct load, DevTools → Network shows `movie/550` and **no** `movie/popular`.
11. With Slow 3G throttling, the skeleton shows while the details load, and Back stays usable.
12. `/movie/999999999` shows "Movie not found." with Retry and Back. `/movie/abc` shows "Invalid movie id" with no request.
13. At about 375 px the details page is stacked; at 768 px or wider the poster sits beside the text. The list grid is still 2/3/4/5 columns.

## Validation (the Developer runs and reports each)

1. Preconditions, including the human-owned file's `stat`.
2. The focused specs: `npm test -- --watch=false --include=src/app/movies/movie-detail/movie-detail.spec.ts` (and the card spec).
3. `npm test -- --watch=false`: PASS. Report the config log line, the spec files and the test counts.
4. `npm run lint` and `npm run format:check`: PASS.
5. `npm run build`: PASS. Report the lazy chunks for `movie-list` and `movie-detail`.
6. `grep -rnE "effect\(|toSignal|toObservable|linkedSignal|httpResource" src/app --include=*.ts`: no matches.
7. `grep -rn "PROBE\|SHAPE\|console\." src/app`: no matches.
8. The human-owned file's `stat` is unchanged, and `git check-ignore -v` still shows the ignore rule.
9. `git status --short` and `git diff`: only the expected files.

## Acceptance Criteria

1. `MovieDetail` is standalone and uses `inject()`, `input.required`, `computed` and a component-local `rxResource` over `getMovieDetails`. There is no detail state in `MovieService` and no `effect()`.
2. It shows the title, poster, overview, genres, rating and release date, with the fallbacks listed above. It has loading, error (404 and generic) with Retry, invalid-id and success states, and Back to `/` on every non-loading state.
3. The route `movie/:id` is lazy-loaded with the title `'Movie details'`. `''` and `'**'` are preserved. `app.config.ts` adds exactly `withComponentInputBinding()` and `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`.
4. A deep link sends only the details request, with no popular request; a test proves it.
5. `MovieCard` is a single native router link to `/movie/{id}`, with a pointer cursor, restrained hover and visible `focus-visible` styling. Its content is unchanged, with no rating or year.
6. The accepted T3 accessibility fixes are preserved: the status line is silent on error, and focus returns after Clear.
7. All specs pass on the normal configured test path, and lint, format:check and build pass.
8. Only the expected files changed. There are no new dependencies, no T2 changes, and the human-owned file is untouched.
9. The manual checklist is reported as "Requires human verification".

## Expected Files

- **Create:** `src/app/movies/movie-detail/movie-detail.ts`, `movie-detail.html` and `movie-detail.spec.ts`.
- **Modify:**
  - `src/app/app.routes.ts`
  - `src/app/app.config.ts`
  - `src/app/movies/movie-card/movie-card.ts` and `movie-card.html`
  - `src/app/movies/movie-card/movie-card.spec.ts`
  - `src/app/movies/movie-list/movie-list.spec.ts`, test setup only and only if needed
  - `src/app/app.spec.ts`, only if needed
- **Everything else is protected.**

## Stop Conditions

- A precondition fails, or the test path stops using `vitest-base.config.mjs`.
- `withComponentInputBinding` does not bind `:id` to `input.required<string>()`.
- `rxResource` does not stay idle for `undefined` params.
- A deep link triggers `movie/popular`, and fixing it would need a T2 change.
- A criterion needs a file outside Expected Files, a new dependency, or a pattern listed as out of scope.
- Any step would touch or compile `environment.local.ts`.
- The same issue fails two review/fix cycles.

## Completion Report

Use the `developer.md` format (Summary, Changed Files, Key Implementation Decisions, Validation, Deviations, Risks / Follow-up, Git Status). Also include:

- the deep-link evidence (one details request, no popular request);
- the human-owned file's `stat`, before and after;
- the Manual Browser Verification list, marked **"Requires human verification"**.

Never include token values. Do not commit, push or start further work.

## Resolved Decisions (carried forward)

1. **Tests:** the Developer writes focused tests for the behaviour it implements. QA validates features independently later.
2. **Empty token:** no client guard; TMDb's 401 is mapped by `errorMessage()`.
3. **Local file:** `environment.local.ts` is human-owned and never touched by agents.
4. **Test path:** the normal `npm test` run with `vitest-base.config.mjs` is authoritative.
5. **Card content:** poster, title and overview only.
6. **Card link:** added now, in T4, together with the real detail route. The pointer cursor, subtle hover and visible focus come from the human's T3 browser review.

7. **Empty genres (human, resolved):** the genres field stays visible and shows "No genres listed." when `genres` is empty.
8. **Back behaviour (human, resolved):**
   - Keep `routerLink="/"` for "Back to movies", with no `Location.back()`, history logic or scroll persistence.
   - The in-app Back keeps the `MovieService` query and results with no intended refetch.
   - Restoring the exact scroll position is not a T4 requirement. The browser's own Back is not reimplemented.
9. **Routing chain (human, resolved):** `movie/:id` → `withComponentInputBinding()` → required `id` input → local resource → `getMovieDetails(id)`. No direct `ActivatedRoute` parameter handling.

## Open Questions

None.
