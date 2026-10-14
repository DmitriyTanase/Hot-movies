# Task Handoff — T3: Movie List, Search, Card, and Real TMDb List Integration

- **Architecture:** `.claude/docs/architecture-proposal.md` (APPROVED — Gate #1). The sections that apply:
  - 3 — ambiguities: dynamic search, button + typing, Back;
  - 4 — layout;
  - 5.2 and 6 — list state and ownership;
  - 7 — idle start, `loadList()`;
  - 8 — Signals/RxJS boundary;
  - 9 — search behaviour (authoritative for MovieSearch);
  - 10 — component boundaries (authoritative for MovieList, MovieSearch and MovieCard);
  - 11 — routing (list route only in T3);
  - 14 — states and UI;
  - 17 — testing (MovieList, MovieSearch and MovieCard rows);
  - 18.8 — skeleton flash, accepted.
- **Requirements:** `.claude/context/assignment.md`, sections 2, 3 and 5 (Список фильмов, Поиск фильмов, UI и стилизация). Also the general "Обязательно использовать" list: Signals, Tailwind, standalone components, `@if`/`@for`/`@switch`.
- **Existing contract (T2, committed in `5ddcaa4`). Use it as is and do not modify it:**
  - `src/app/movies/movie.service.ts`:
    - signals: `querySignal`, `moviesSignal`, `loadingSignal`, `errorSignal`;
    - commands: `loadList()`, `setQuery(keyword)`, `reloadList()`.
  - `src/app/movies/movie.ts`: `Movie`.
  - `src/app/movies/tmdb.ts`: `posterUrl(path, 'w342' | 'w500')`.
- **Owner:** Developer.

---

## Goal

Build the routed home page:

- `MovieList` shows popular movies or search results from `MovieService`;
- `MovieSearch` handles debounced and immediate search;
- `MovieCard` shows a single movie.

Show loading, error and empty states, in a responsive Tailwind grid. The component state must not duplicate the service state. Do not commit.

## Human-Owned Local File (carried forward from T2)

`src/environments/environment.local.ts` holds the human's real token, and Git ignores it. The Developer and the Reviewer must **not**:

- read, open, `cat`, `grep`, Glob into, hash, copy, move, overwrite or delete it;
- expose its contents anywhere;
- run `npm run start:local`, `--configuration local` or `--build-target=…:local`;
- search `dist/` or `.angular/`.

Limit recursive searches to `src/app`. Only `ls`, `stat -c '%s %Y'`, `git check-ignore` and `git status` are allowed on it. The real-token browser check is **human-only** (see Manual Browser Verification).

## Preconditions

- `git status` is clean, apart from this handoff file.
- `npm run build`, `npm test -- --watch=false`, `npm run lint` and `npm run format:check` pass. If any fails, STOP.
- Record `stat -c '%s %Y' src/environments/environment.local.ts` (metadata only).
- **Test path:** `npm test -- --watch=false` is the authoritative test command. Its output must show `Using Vitest configuration file: …vitest-base.config.mjs`, which means `fsModuleCache` is off. Do not bypass it with one-off runner configs or flags. If results ever look stale, STOP and report; do not work around it.

## In Scope

- **Components, under `src/app/movies/` with 2025 naming:**
  - `movie-list/movie-list.{ts,html}`
  - `movie-search/movie-search.{ts,html}`
  - `movie-card/movie-card.{ts,html}`
  - optional `.css` files only if Tailwind classes cannot do the job.
- **Routes in `src/app/app.routes.ts`:**
  - `''` → `loadComponent` `MovieList`, with title `'HOT Movies'`;
  - `'**'` → `redirectTo: ''`.

  These follow §11 exactly, minus the detail route (T4).
- **Focused specs** for the three components (see Tests).

## Out of Scope

- **Detail:** `MovieDetail`, the `movie/:id` route, any detail placeholder, and detail API use.
- **`app.config.ts` changes:** `withComponentInputBinding()` and `withInMemoryScrolling()` serve the detail page and arrive in T4.
- **Excluded features:** pagination, URL-synchronized search, SSR.
- **Excluded tools:** new state abstractions, NgRx or SignalStore, any new dependency, `effect()`, `toSignal`, `toObservable`, `linkedSignal`, Signal Forms.
- **Files T3 must not touch:**
  - `MovieService`, the types, helpers or their specs;
  - `app.ts`, `app.html` (the header already exists), `README.md`, `angular.json`, `package.json`, `vitest-base.config.mjs`.
- **Other:** unrelated refactoring, and visual features the assignment doesn't require.

## Component Responsibilities (§10; the architecture is authoritative)

| Component | Contract |
|---|---|
| `MovieList` | Injects `MovieService` and calls `loadList()` in its constructor; a return visit is a no-op. Renders `<app-movie-search>`, then exactly one of the states in the next table. The grid uses `@for (m of movies(); track m.id)` with `<app-movie-card [movie]="m" />`. Has an `aria-live="polite"` status line. Reads the service signals directly and does not copy them into local state |
| `MovieSearch` | Injects `MovieService`. `draft = signal(movieService.querySignal())`, seeded once. Holds one pending-timer field, cleared with `DestroyRef.onDestroy`. Uses a `role="search"` `<form>` with a visually hidden `<label>` (`sr-only`), a text input, a `type="submit"` "Search" button, and a clear button (×) with an `aria-label`, shown only while `draft()` is not empty |
| `MovieCard` | `movie = input.required<Movie>()`. **In T3 the card is a non-interactive `<article>`, with no `routerLink`** (Resolved Decision 6). Poster: `posterUrl(poster_path, 'w342')`, `loading="lazy"`, `alt` = title. Without a poster, a 2:3 "No poster" placeholder. Then the title as a heading, and the overview with `line-clamp-3`, or "No description available." when it is empty. **Content is exactly poster, title and overview, with no rating or year** (Resolved Decision 5). Add no link affordances: no `cursor-pointer`, no hover or focus link styling, no `tabindex`, no `role="link"` and no click handler |

## Search Behaviour (§9, exact)

| Action | Behaviour |
|---|---|
| Type non-blank text | `clearTimeout(pending)`, then `pending = setTimeout(() => setQuery(draft()), 300)` |
| Text becomes empty or whitespace only | `clearTimeout(pending)`, then **immediate** `setQuery('')` (popular) |
| Search button or Enter (form `submit`) | `preventDefault`, `clearTimeout(pending)`, then **immediate** `setQuery(draft())` |
| Clear (×) | `draft.set('')`, `clearTimeout(pending)`, then **immediate** `setQuery('')` |
| Component destroyed | The pending timer is cleared, so no late `setQuery` fires |

- Trimming, dedupe of the same effective query, and cancelling stale requests all stay in `MovieService`. Do not add them in the component.
- The input stays usable during loading.

## UI / State (§14)

- **Exactly one state renders,** chosen from the service signals with `@if`/`@else` or `@switch`, in this order:

  | Condition | Shows |
  |---|---|
  | `errorSignal()` | The error message and a "Retry" button that calls `reloadList()` |
  | `loadingSignal()` | A skeleton grid with `aria-busy="true"` |
  | No movies, with a query | `No movies found for "<query>".` |
  | No movies, without a query | `No movies available.` |
  | Otherwise | The grid |

- **Grid:** `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`, with a gap and page padding.
- **Accessibility and styling:**
  - visible `focus-visible` rings on the input and the buttons;
  - semantic landmarks (the shell already has `<main>`), and the movie cards as `<article>` elements;
  - Tailwind v4 utilities only, with no component library.
- **Card navigation is deferred to T4** (Resolved Decision 6). In T3 cards are not clickable, there is no `movie/:id` route, and no placeholder.

## Tests (Developer-written and focused; QA validates independently later)

The Developer is authorized to write focused component tests for the behaviour built in T3. QA keeps feature-level validation. Aim for meaningful behaviour, not a coverage figure.

**Tools:**

- `TestBed`;
- `provideHttpClient()` together with `provideHttpClientTesting()` and `HttpTestingController` (the real `MovieService`);
- `vi.useFakeTimers()` for the debounce;
- flush resources with `await TestBed.inject(ApplicationRef).whenStable()`, as T2 established.

Specs use the committed empty-token `environment.ts`.

- **`movie-search.spec.ts`** (spy on `MovieService.setQuery`):
  - typing commits only after 300 ms, not before;
  - several keystrokes give a single commit;
  - submit and Enter commit immediately, and no second commit follows at 300 ms;
  - clearing or whitespace commits `''` immediately;
  - the × button clears the draft and commits `''`;
  - destroying the component while a timer is pending means no commit;
  - the draft starts from `querySignal()`.
- **`movie-list.spec.ts`** (real service with `HttpTestingController`):
  - creating the component sends one popular request;
  - the loading skeleton appears;
  - after the flush, N cards render;
  - a 500 response shows the error, and Retry sends the request again;
  - an empty popular result shows "No movies available.";
  - an empty search shows `No movies found for "x".`
- **`movie-card.spec.ts`:**
  - poster `src` and `alt` versus the placeholder;
  - overview versus the fallback text;
  - the card renders no `<a>` or `href` and is not focusable (it is non-interactive in T3);
  - no rating or year text appears.
- **`app.spec.ts`:** keep it passing. Edit it only if the new routes require it.

## Manual Browser Verification (HUMAN ONLY; the Developer documents it and does not run it)

1. Run `npm run start:local` and open `http://localhost:4200`.
2. **Real token, end to end** (this closes the T2 manual check B):
   - popular movies load;
   - DevTools → Network → `movie/popular` shows a 200 response and an `Authorization: Bearer …` header. Do not copy the header anywhere.
3. **Typing:** type `bat`. A single `search/movie` request goes out about 300 ms after the last keystroke.
4. **Immediate search:** type `batman` and press Enter right away. One request goes out at once, with no second request 300 ms later. Repeat with the Search button.
5. **Clear:** select all and delete. Popular returns immediately. Do the same with `"   "` and with the × button.
6. **Cancellation:** in DevTools, use network throttling (Slow 3G). Type `star`, wait, then type `star wars`. The earlier request shows as cancelled, and only the `star wars` results appear.
7. **Empty search:** search `zzzzzzzzqx`. The page shows `No movies found for "zzzzzzzzqx".`
8. **Error:** in DevTools, go Offline and press Retry or search. The network error message and Retry appear. Go back Online and press Retry: it recovers.
9. **Missing token:** stop the server and run `npm start` (empty token). The page shows "TMDb access token is missing or invalid. See README → Setup."
10. **Layout and keyboard:**
    - resize to about 375 px, then 768 px, then 1280 px; the grid goes 2, 3/4, then 5 columns;
    - tab through the input, the Search button and the × button; the focus rings are visible;
    - the cards are not tab stops and do not look clickable (navigation arrives in T4).

## Validation (the Developer runs and reports each)

1. Preconditions, including the human-owned file's `stat`.
2. `npm run build`: PASS. Report the lazy chunk for `movie-list`.
3. `npm test -- --watch=false`: PASS. Report the config log line, the list of spec files and the test counts.
4. `npm run lint` and `npm run format:check`: PASS.
5. `grep -rnE "effect\(|toSignal|toObservable|linkedSignal|httpResource" src/app --include=*.ts`: no matches.
6. `grep -rn "PROBE\|SHAPE\|console\." src/app`: no matches.
7. The human-owned file's `stat` is unchanged, and `git check-ignore -v` still shows the ignore rule.
8. `git status --short` and `git diff --stat`: only the expected files.

## Acceptance Criteria

1. The three components exist, are standalone, use `@if`/`@for`/`@switch`, have no explicit `changeDetection`, and use `inject()`.
2. `MovieList` calls `loadList()`. No request is sent before `MovieList` is created. Movies, loading and error come only from the `MovieService` signals.
3. `MovieSearch` matches the §9 table exactly (300 ms debounce; immediate submit, Enter, clear and empty; timer cleared on destroy), and none of the service logic is duplicated.
4. Each card shows the poster or placeholder, the title, and the overview or its fallback, and nothing else. The card is a non-interactive `<article>`: no `routerLink`, no link styling, and not focusable.
5. The loading, error with Retry, the two exact empty messages, and the grid states render as described.
6. The routes are exactly `''` (lazy `MovieList`, title `'HOT Movies'`) and `'**'` → `''`. `app.config.ts` is unchanged.
7. The grid is responsive, the controls are accessible, and the focus rings are visible.
8. All the T3 specs pass through the normal configured test command, with build, lint and format:check also passing.
9. The human-owned file was not touched. There is no new dependency and no file outside Expected Files changed.
10. The manual verification steps are listed in the completion report and marked "Requires human verification".

## Expected Files

- **Create:**
  - `src/app/movies/movie-list/movie-list.ts`, `movie-list.html` and `movie-list.spec.ts`
  - `src/app/movies/movie-search/movie-search.ts`, `movie-search.html` and `movie-search.spec.ts`
  - `src/app/movies/movie-card/movie-card.ts`, `movie-card.html` and `movie-card.spec.ts`
- **Modify:** `src/app/app.routes.ts`, plus `src/app/app.spec.ts` only if needed.
- **Everything else is protected,** including `app.config.ts`, the T2 files, the configuration files and `.claude/**`.

## Stop Conditions

- A precondition fails, or the test path stops using `vitest-base.config.mjs`.
- A criterion needs a T2 file change, an `app.config.ts` change, a new dependency, or a pattern listed as out of scope.
- Any step would touch or compile `environment.local.ts`.
- Angular 22.2.2 behaves differently from the architecture, for example signal inputs, `DestroyRef` or resource flushing in tests.
- The same issue fails two review/fix cycles.

## Completion Report

Use the `developer.md` format (Summary, Changed Files, Key Implementation Decisions, Validation, Deviations, Risks / Follow-up, Git Status). Also include:

- confirmation that no request is sent before `MovieList` is created;
- the `stat` of the human-owned file, before and after;
- the Manual Browser Verification list, marked **"Requires human verification"**.

Never include token values. Do not commit, push or start T4.

## Resolved Decisions (carried forward)

1. **Tests:** the Developer writes focused tests for the behaviour it implements. QA validates features independently later.
2. **Empty token:** no client guard; TMDb's 401 is mapped by `errorMessage()` (§13.5).
3. **Local file:** `environment.local.ts` is human-owned and never touched by agents.
4. **Test path:** the normal `npm test` run with `vitest-base.config.mjs` (`fsModuleCache: false`) is authoritative.
5. **Card content (human, resolved):** `MovieCard` shows exactly poster, title and overview, per the assignment and architecture §10. It shows no rating and no release year; those stay in `MovieDetail` (T4).
6. **Card navigation sequencing (human, resolved):**
   - In T3, **do not** add the whole-card `routerLink`, a placeholder `movie/:id` route, or an early `MovieDetail`.
   - The card must not look or behave like a link while it is not one.
   - In T4, the whole-card link to `/movie/:id` (§10) is added together with the real `MovieDetail` route.
   - This is a sequencing clarification only. The final approved architecture (§10, §11) is unchanged, so do not read §10 as requiring the link in T3.

## Open Questions

None.
