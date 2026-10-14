# Task Handoff — T5: UI Polish

- **Architecture:** `.claude/docs/architecture-proposal.md` (APPROVED). §14 (UI: Tailwind v4, no component library, focus-visible). Nothing else changes.
- **Requirements:** `.claude/context/assignment.md` §5 (responsive, visually tidy).
- **Base:** T4 committed (`ca5c263`).
- **Owner:** Developer. Human-requested polish only; **pagination is T6**.

## Goal

Three visual refinements, with no change to behaviour, state, routing, API contracts or dependencies.

## Human-Owned Local File (carried forward)

Do not read, grep, hash, copy, modify or delete `src/environments/environment.local.ts`, and do not run `start:local` or any `local` configuration. Limit searches to `src/app`. Only `stat -c '%s %Y'`, `ls`, `git check-ignore` and `git status` are allowed on it.

## Preconditions

- `git status` is clean, apart from this handoff file.
- Record the human-owned file's `stat`.
- `npm test -- --watch=false` is authoritative and must log `vitest-base.config.mjs`.

## In Scope

### 1. MovieCard consistency (`movie-card.html`)

- **Equal heights:** cards in the same grid row have equal height. Grid items stretch by default; make the `<a>` `h-full` with `flex flex-col`, and let the `<article>` and text area grow (`flex-1`).
- **Clamping:** the poster keeps `aspect-[2/3]`. The title gets `line-clamp-2`, and the overview keeps `line-clamp-3`.
- **No fixed heights:** no fixed pixel heights; use only flex and line clamping.
- **Preserve:** the whole-card `routerLink`, `aria-labelledby` → the `<h2>` id, the poster `alt` = title, `cursor-pointer`, hover lift and shadow, `focus-visible` outline, and the content (poster, title, overview).

### 2. Search layout (`movie-search.html`, plus the host class if needed)

- **Widths:** on small screens the form uses the full width. From `md:` it is right-aligned and constrained to about 350–450 px (for example `md:ml-auto md:max-w-md`).
- **Host element:** if the custom element is inline, make it a block through the component `host: { class: 'block' }` metadata. Do not use a stylesheet.
- **Preserve:**
  - debounce, submit and Enter, clear, and focus return after Clear;
  - `role="search"`, the label, `aria-label`;
  - the focus rings.

### 3. Back to movies (`movie-detail.html`)

- **Markup:** still `<a routerLink="/">`, rendered once outside the state chain, so it shows in every state (T4).
- **Style:** a restrained secondary or outline button (for example `inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50`), keeping the visible `focus-visible` outline. Remove the underline-link styling.
- **Icon:** a small inline-SVG left arrow, `aria-hidden="true"` with `focusable="false"`, so the accessible name stays "Back to movies". Add no icon library.

## Out of Scope

- **Excluded features:** pagination, new features, new dependencies, any new CSS file or custom CSS.
- **Off-limits code:** changes to TS logic, services, routes, `app.config.ts`, the list or detail states, or the text content.
- **Other:** unrelated redesign or refactoring, and the app.config test gap.

## Tests

- Do not assert Tailwind class names mechanically.
- Every existing test must still pass unchanged, apart from minimal adjustments if a selector breaks.
- **Only if useful,** add an accessibility assertion that the Back link's accessible text is exactly "Back to movies" and that the SVG is `aria-hidden`.

## Validation

1. `npm test -- --watch=false` (log line, counts).
2. `npm run lint`.
3. `npm run format:check`.
4. `npm run build`.
5. `git status --short` and `git diff`: only the files below changed.
6. The human-owned file's `stat` is unchanged.

## Expected Files

- **Modify:**
  - `src/app/movies/movie-card/movie-card.html`
  - `src/app/movies/movie-search/movie-search.html` (and `movie-search.ts` only for `host` metadata)
  - `src/app/movies/movie-detail/movie-detail.html`
- **Optional:** `movie-detail.spec.ts`, for the accessible-name assertion.
- **Everything else is protected.**

## Acceptance Criteria

1. Cards in a row have equal heights, with a 2:3 poster, a title of 2 lines at most and an overview of 3 lines at most, and no fixed pixel heights. All T4 card link and accessibility behaviour is preserved.
2. Search is full width on small screens and right-aligned at about 350–450 px from `md:`. All search behaviour and accessibility are unchanged.
3. Back is an outline-style `<a routerLink="/">` with an `aria-hidden` inline-SVG arrow and a visible focus outline, and it is present in every detail state.
4. Tests, lint, format:check and build pass. Only the expected files changed, there are no new dependencies, and the human-owned file is untouched.

## Stop Conditions

- A requirement needs logic, routing, service or dependency changes, or a custom stylesheet.
- A test can only pass by weakening behavioural assertions.
- Any step would touch `environment.local.ts`.

## Completion Report

Use the `developer.md` format. Include the human-owned file's `stat` before and after. Do not commit or push.

## Manual Browser Verification (HUMAN ONLY)

1. Run `npm run start:local`. Cards in each row have equal heights, long titles clamp to 2 lines and overviews to 3, and the posters are 2:3.
2. Hover and keyboard focus on cards still work, and Enter opens the details page.
3. At 1280 px the search is right-aligned and about 448 px wide. At 375 px it is full width. Typing, Enter, Search and × behave as before.
4. On the details page, Back looks like an outline button with an arrow, it is focusable with a visible ring, and it is present while loading (Slow 3G), on error, for an invalid id and on success.
