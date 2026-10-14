# Task Handoff — T2: TMDb Data and List-State Layer

- **Architecture:** `.claude/docs/architecture-proposal.md` (APPROVED — Gate #1, 2026-10-14). Sections that apply: 0, 2.3, 2.6, 2.7, 4, 5, 6, 7, 8, 9 (service-side guarantees only), 12, 13, 15, 16 (D2, D5, D6), 17 (service-level rows), 18 (items 2–3).
- **Requirements source:** `.claude/context/assignment.md` → "Функциональные требования → 1. Работа с API".
- **Owner:** Developer.
- **Scope:** the data/state layer only. **No movie UI, no routes.**

---

## Goal

Implement `MovieService` and its supporting files exactly as described in architecture §4, §5 and §12:

- the three typed TMDb HTTP methods;
- the `rxResource`-driven list state, exposed as signals;
- error normalization.

Add focused unit tests for the service contract. The full chain from `environment.local.ts` to the `Authorization` header is verified **manually by the human** (Technical Notes §3), because the human-owned local file must not be touched. Do not commit.

## Human-Owned Local File (`src/environments/environment.local.ts`)

This file exists. It holds the human's real TMDb token, and Git ignores it. It is human-owned local configuration. The Developer must **not**:

- read, open, print, `cat`, `grep`, Glob-match into, hash, copy, move, rename, overwrite or delete it;
- include its contents, or the real token, in context, logs, tests, fixtures or the completion report;
- run anything that compiles it:
  - `npm run start:local`;
  - `ng serve` or `ng build` with `--configuration local`;
  - `ng test` with `--build-target=…:local`;
- search `dist/` or `.angular/` for token strings.

Recursive searches over `src/` must exclude this file (`--exclude=environment.local.ts`) or be limited to `src/app`. Only metadata checks that do not read the contents are allowed: `ls`, `stat -c '%s %Y'`, `git check-ignore`, `git status`.

## Preconditions

- T1 is in the working tree: Angular 22.2.2, Vitest, ESLint, Prettier, the `local` build/serve configuration, and the `.gitignore` rule for `src/environments/environment.local.ts`.
- These baseline commands pass before any change:
  - `npm run build`
  - `npm test -- --watch=false`
  - `npm run lint`
  - `npm run format:check`

  If any fails, STOP and report.
- Record the metadata of the human-owned file with `stat -c '%s %Y' src/environments/environment.local.ts` (size and mtime only).
- Confirm `git check-ignore -v src/environments/environment.local.ts` shows the ignore rule.

If the file is absent, do not create it. Report that and continue, because T2 does not need it.

## In Scope

All new files go in `src/app/movies/`:

1. **`movie.ts`:** `Movie`, `MovieDetails` and `TmdbPage<T>`, exactly as in §12. Only the fields listed there.
2. **`tmdb.ts`:**
   - the API base URL `https://api.themoviedb.org/3`;
   - the image base URL `https://image.tmdb.org/t/p/`;
   - `posterUrl(path: string | null, size: 'w342' | 'w500'): string | null`, which returns `null` for a `null` path.
3. **`error-message.ts`:** `errorMessage(err: unknown): string` with the four cases and exact strings in §12.
   - It unwraps `err.cause` when the resource wraps the error.
   - It finds the `HttpErrorResponse` status: 401, 404, 0, otherwise the generic message.
4. **`movie.service.ts`** (`@Injectable({ providedIn: 'root' })`), per §5.1 and §5.2:
   - `getPopularMovies(): Observable<Movie[]>`, `searchMovies(keyword: string): Observable<Movie[]>` and `getMovieDetails(id: number): Observable<MovieDetails>`.
     - URLs and query parameters exactly as in the §5.1 table.
     - Use `HttpParams` / the `params` option so the keyword is encoded. Do not concatenate strings.
     - The list methods `map(r => r.results)`.
   - One private `HttpHeaders` constant: `Authorization: Bearer ${environment.tmdbAccessToken}`, imported from `src/environments/environment`.
   - The list state as written in §5.2:
     - a private `query` signal (`string | undefined`, starting as `undefined`);
     - a private `list` `rxResource`;
     - `querySignal`, `moviesSignal`, `loadingSignal` and `errorSignal`;
     - `loadList()`, `setQuery(keyword)` and `reloadList()`.
5. **Specs:**
   - `movie.service.spec.ts` and `error-message.spec.ts` are required.
   - A two-case `tmdb.spec.ts` for `posterUrl` is optional.
6. **Hand-off of the local-token check:** the Developer does not run it. The completion report repeats the manual procedure in Technical Notes §3 for the human.

## Out of Scope

Do not create or change any of the following:

- **Movie UI and routing:**
  - `MovieList`, `MovieSearch`, `MovieCard`, `MovieDetail`, or any other movie component, template or styling;
  - movie routes and `app.routes.ts` changes;
  - `app.config.ts` changes, including `withComponentInputBinding` and `withInMemoryScrolling`, which come later.
- **Other components' state:**
  - the details `rxResource`, which is component-local in `MovieDetail` (§6, D4);
  - debounce and timers, which belong to `MovieSearch` (§9).
- **Behaviour the architecture excludes:**
  - pagination, URL-synchronized search, SSR;
  - NgRx, SignalStore or any other state library;
  - facade, repository, API-client, interceptor, mapper or use-case layers;
  - an `InjectionToken` for the token.
- **Signal patterns the architecture rules out:**
  - `effect()`, `toSignal`, `toObservable`, `linkedSignal`, `httpResource`.
- **Unrelated files:**
  - the README, `angular.json`, `package.json` or any dependency;
  - unrelated scaffold cleanup, including `.vscode/launch.json`.

## Implementation Constraints

- **Signals and RxJS:**
  - Signals hold the application state. RxJS is used only for the `HttpClient` return values.
  - `rxResource` is the only bridge between them (§8). It must call `getPopularMovies()` / `searchMovies()`; do not issue separate HTTP calls from the resource.
- **Idle start:**
  - Constructing `MovieService` must send **no** request (§7).
  - `loadList()` sets the query to `''` only while it is still `undefined`. After that it is a no-op.
- **Query handling:**
  - `setQuery()` trims the keyword. `''` means popular.
  - Use default signal equality, so an equivalent effective query sends no new request (§9).
  - `setQuery()` must not set a custom `equal` and must not add extra dedupe logic.
- **Derived signals:**
  - `moviesSignal` is derived through a `hasValue()` guard. Never read `value()` in the error state (§2.6, §18.2).
  - `errorSignal` is `string | null` and comes from `errorMessage()`.
  - `loadingSignal` is `list.isLoading`.
- **Cancellation:** use the resource's native abort on parameter change. No manual `switchMap`, no request IDs, no subjects.
- **HTTP provider:** do **not** add `provideHttpClient()` to the app config, because v21+ provides it by default (§4, §15). Tests use `provideHttpClient()` together with `provideHttpClientTesting()`.
- **Missing or invalid token**, handled as in §13.5:
  - with no client-side pre-check or short-circuit, the request is still sent;
  - TMDb's 401 maps to "TMDb access token is missing or invalid. See README → Setup.";
  - do not throw at construction.
- **Credentials:**
  - no real token in any file, test, fixture, log, comment or report;
  - never describe the token as secret.
- **Conventions:** follow the scaffold conventions — 2025 file naming, `inject()`, no explicit `changeDetection`, strict types, no `any`.

## Tests (Developer-written, focused; for this task only)

Resolved Decision 1 authorizes the Developer to write these tests. Use these tools:

- Vitest;
- `TestBed`, `provideHttpClient()`, `provideHttpClientTesting()`, `HttpTestingController`;
- flush resource loads with `TestBed.tick()` (or `await` stability) before asserting (§17, §18.3);
- `httpMock.verify()` in `afterEach`.

The specs run against the committed `environment.ts` (empty token), using the default `ng test` build target (`development`, which has no file replacement). No spec may depend on `environment.local.ts` or on the real token.

**`movie.service.spec.ts` must cover:**

| # | Behaviour |
|---|---|
| 1 | `getPopularMovies()`: GET `…/movie/popular` with `language=en-US` and `page=1`. It returns `results` as `Movie[]` |
| 2 | `searchMovies('star wars')`: GET `…/search/movie` with `query=star wars` (read from `req.request.params`), `include_adult=false`, `language=en-US`, `page=1`. It returns `results` |
| 3 | `getMovieDetails(42)`: GET `…/movie/42` with `language=en-US`. It returns the body as `MovieDetails` |
| 4 | The `Authorization` header equals `` `Bearer ${environment.tmdbAccessToken}` `` on all three methods |
| 5 | **Missing token:** with the committed empty token the request is still sent, with header `'Bearer '`. A 401 response sets `errorSignal` to the exact missing-token message |
| 6 | **Idle:** after constructing the service and ticking, there is no request. `moviesSignal()` is `[]`, `loadingSignal()` is `false`, `errorSignal()` is `null` and `querySignal()` is `''` |
| 7 | **Initial load:** `loadList()` sends one popular request. While it is pending, `loadingSignal()` is `true`. After the flush, `moviesSignal()` holds the results and `loadingSignal()` is `false` |
| 8 | A second `loadList()`, including after a search, sends no request and keeps the current query |
| 9 | **Search transition:** `setQuery('bat')` sends a search request, and `querySignal()` is `'bat'`. After the flush, `moviesSignal()` holds the search results |
| 10 | **Whitespace and clear:** `setQuery('   ')` or `setQuery('')` after a search sends a popular request, and `querySignal()` is `''` |
| 11 | **Dedupe:** `setQuery('bat')` followed by `setQuery('bat ')` sends exactly one request |
| 12 | **Stale and cancel:** while the `'bat'` request is pending, `setQuery('batman')` makes the first request `cancelled`. Only the `'batman'` results appear |
| 13 | **Error:** a 500 response sets `errorSignal` to the generic message, `loadingSignal()` to `false` and `moviesSignal()` to `[]`, with no throw. A following new query clears the error |
| 14 | **Reload:** `reloadList()` after an error resends the same query's request. On success `errorSignal()` is `null` and the movies are shown |

**`error-message.spec.ts`:** cover 401, 404, 0, another status (e.g. 500), a non-HTTP error, and an `HttpErrorResponse` wrapped in `{ cause }`.

Do not add tests only to increase coverage.

## Technical Notes

### 1. Resource error shape

Confirm in the first error test how the resource exposes the stream error, either the raw value or wrapped in `cause`. `errorMessage` must handle both (§12). Report what you observed.

### 2. Keep the spec independent of the token value

Assert the header by importing `environment` from `src/environments/environment` in the spec; do not hard-code a token. Test 5 is the only one that asserts the literal `'Bearer '`.

### 3. Local-token verification: MANUAL, human-run

**Why the Developer cannot run it:**

- Nothing exists in Angular 22.2.2 for pointing `local` at a different temporary file without changing `angular.json`, which is protected:
  - `ng test` and `ng build` have no CLI flag that overrides `fileReplacements`;
  - the `unit-test` builder takes only `buildTarget`, and a new configuration would have to be added to `angular.json`.
- Running the existing `local` configuration would compile the human-owned real token into a Developer-run build or test.
- A Vitest alias through `runnerConfig` would bypass Angular's `fileReplacements`, so it would not verify the approved path.

**What T2 still proves automatically:**

- `MovieService` builds its header from `environment.tmdbAccessToken` (test 4, using the imported `environment`).
- T1 proved that the `local` configuration resolves the replacement.

**Manual procedure (human only, in their own terminal, after T2):**

- **A, optional, available after T2:**
  - Run `npx ng test --watch=false --build-target=hot-movies:build:local --include=src/app/movies/movie.service.spec.ts`.
  - Expected result: **only test 5** (the literal `'Bearer '` assertion) fails, and all the other tests pass.
  - That shows `environment.local.ts` replaced `environment.ts` and that its token reached the `Authorization` header.
  - The failure diff prints the real header value. Do not paste that output into chat, agents or files.
- **B, the required end-to-end check, at the first task where `MovieList` calls `loadList()` (T3):**
  - Run `npm run start:local` and open the app.
  - The popular movies load (HTTP 200), and DevTools → Network → `movie/popular` → Request Headers shows `Authorization: Bearer …`.
  - Then run `npm start` (empty token) and confirm the mapped "TMDb access token is missing or invalid" message appears.

## Validation (report each result)

1. Preconditions: the baseline commands, plus the human-owned file's `stat` metadata and its `git check-ignore` line.
2. `npm run build`: PASS. This is the default production configuration, with no file replacement.
3. `npm test -- --watch=false`: PASS. List the spec files and test counts.
4. `npm run lint`: PASS.
5. `npm run format:check`: PASS.
6. **Human-owned file unchanged:**
   - `stat -c '%s %Y' src/environments/environment.local.ts` matches the precondition values;
   - `git check-ignore -v src/environments/environment.local.ts` still shows the ignore rule;
   - `git status --short --ignored src/environments` lists it only as ignored (`!!`).
7. `git status --short`: only the allowed files are new. The only modified file is `.claude/context/task-handoff.md`, which was changed before T2.
8. `git diff --stat`: no tracked application file changed.
9. `grep -rnE "effect\(|toSignal|toObservable|linkedSignal|httpResource|provideHttpClient\(" src/app --include=*.ts`: matches only `provideHttpClient(` in the spec files.

## Acceptance Criteria

1. The four source files exist in `src/app/movies/` and match architecture §5 and §12 in names, signatures, URLs, parameters and messages.
2. The three methods return typed, cold Observables carrying the Bearer header. They hold no state.
3. The list resource starts idle and no request is sent at construction. `loadList()` starts popular only once.
4. `setQuery` trims and deduplicates through signal equality. `''` and whitespace mean popular. A query change cancels the in-flight request, so stale results cannot appear.
5. `moviesSignal`, `loadingSignal`, `errorSignal` and `querySignal` are derived from the resource or query exactly as in §5.2. The error state never throws.
6. `reloadList()` refetches the current query.
7. An empty or invalid token produces the mapped 401 message. There is no pre-check and no construction-time throw (Resolved Decision 2).
8. All the test rows above are implemented and pass against the committed empty-token `environment.ts`.
9. **Local-token check, marked "Requires manual verification":**
   - the completion report repeats the §3 procedure;
   - the Developer runs nothing that compiles `environment.local.ts`.
10. Build, test, lint and format:check all pass.
11. **The human-owned `environment.local.ts`:**
    - still exists, with unchanged size and mtime;
    - is still ignored by Git;
    - was never read, and its contents appear nowhere in the context or the report.
12. Only the allowed files changed. There are no new dependencies, no `app.config.ts` or `app.routes.ts` changes, and no real token in any file, test or report.

## Allowed Files

- **Create:**
  - `src/app/movies/movie.ts`
  - `src/app/movies/tmdb.ts`
  - `src/app/movies/error-message.ts`
  - `src/app/movies/movie.service.ts`
  - `src/app/movies/movie.service.spec.ts`
  - `src/app/movies/error-message.spec.ts`
  - `src/app/movies/tmdb.spec.ts` (optional)
- **Temporary files:** none.
- **Human-owned, untouchable:** `src/environments/environment.local.ts`. See the section above.
- **Protected (do not modify):**
  - `CLAUDE.md`, `.claude/**`, `docs/**`, `.gitattributes`
  - `README.md`, `angular.json`, `package.json`, `package-lock.json`
  - `src/environments/environment.ts`
  - `src/app/app.*` and every other existing file

## Stop Conditions (stop and report; do not improvise)

- A baseline precondition fails.
- Any step would read, overwrite, compile or otherwise expose the human-owned `environment.local.ts`.
- An approved API behaves differently from §2.3 or §2.6 in Angular 22.2.2, for example:
  - `rxResource` does not start idle when `params` is `undefined`;
  - `rxResource` does not abort on a parameter change;
  - `HttpClient` cannot be injected without `provideHttpClient()`.
- Meeting a criterion would need a file outside Allowed Files, a new dependency, an `angular.json` change, or a pattern listed as out of scope.
- The same issue fails two review/fix cycles (CLAUDE.md §10).

## Completion Report

Use the format in `.claude/agents/developer.md` (Summary, Changed Files, Key Implementation Decisions, Validation, Deviations, Risks / Follow-up, Git Status). Also include:

- the observed resource error shape (Technical Notes §1);
- confirmation that no request is sent before `loadList()`;
- the `stat` and `check-ignore` results for the human-owned file, before and after (metadata only);
- the local-token check marked **"Requires manual verification"**, with procedures A and B from §3.

Never report PASS without execution evidence. Never include token values. Do not commit, push or start T3.

## Resolved Decisions (human, 2026-10-14)

1. **Test ownership:** for T2 the Developer is explicitly authorized to write the focused unit tests for the data/state contract it implements. QA keeps responsibility for later independent feature and integration validation (architecture §17 otherwise applies).
2. **Missing or empty token:** the behaviour stays exactly as approved in architecture §13.5. Add no client-side guard only for an empty token. Let the request go out, and normalize TMDb's authentication failure (401) through `errorMessage()`.
3. **Human-owned local file:** `src/environments/environment.local.ts` holds the human's real token and must not be touched (see the section above). The local file-replacement check is a manual human verification (§3).

## Open Questions (for the human)

None.
