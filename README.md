# HOT Movies

A movie discovery application built with Angular and the TMDb API.

## Prerequisites

- Node.js `^22.22.3 || ^24.15.0`
- A modern npm (10 or newer)
- A TMDb account with an **API Read Access Token**

## Setup

```
git clone … && cd hot-movies
npm install
cp src/environments/environment.ts src/environments/environment.local.ts
# edit environment.local.ts: paste your TMDb "API Read Access Token" into tmdbAccessToken
npm run start:local
```

`src/environments/environment.local.ts` is gitignored. Never put a real token in
`src/environments/environment.ts`, because that file is committed.

### Token security

This is a browser-only application. The token is shipped to the browser, compiled into the
JavaScript bundle and visible in DevTools request headers. **It is not secret.** Use TMDb's
read-only API Read Access Token only. The token is never committed. There is no backend proxy by
design.

Without a token (for example `npm start` on a fresh clone), the application still compiles and
runs, but TMDb requests will be rejected.

## Scripts

| Script                 | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `npm start`            | Development server using the committed (empty) token             |
| `npm run start:local`  | Development server using `src/environments/environment.local.ts` |
| `npm run build`        | Production build (no token)                                      |
| `npm test`             | Unit tests (Vitest)                                              |
| `npm run lint`         | ESLint                                                           |
| `npm run format`       | Format the repository with Prettier                              |
| `npm run format:check` | Check formatting with Prettier                                   |
