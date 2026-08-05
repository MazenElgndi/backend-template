# Changelog

All notable changes to this template, round by round. See
`SECURITY-NOTES.md` for the full reasoning behind any security-related
decision referenced here.

## Round 3 (2026-08-03) — the test infrastructure added in Round 2 had never actually been run

- Fixed 3 real bugs in the test setup itself (not the application code),
  found by running `npm test`/`npm run typecheck` for the first time: a
  test helper file being swept up as a test by `node --test`'s default
  discovery, a `PORT=0` env value that conflicted with `config.js`'s own
  validation, and `jsconfig.json` (a VS Code convention, not read by
  `tsc`) silently making `npm run typecheck` check nothing. Full detail
  and the exact fixes: `SECURITY-NOTES.md`, "Round 3."
- `npm test`: 33/33 passing. `npm run typecheck`: 0 errors, now genuinely
  checking `server.js`, `src/**/*.js`, and the test files.

## Round 2 (2026-08-03) — testing, CI/CD, type-checking

- **Added tests** (`node:test`, zero new runtime dependencies): unit
  tests for `escapeHtml.js`, `contact.schema.js`, and `config.js`'s env
  parsing (including a regression test for the `SMTP_SECURE`
  string-coercion bug below); integration tests for the full
  `POST /api/contact` flow (valid submission, invalid input, honeypot,
  missing/wrong origin, malformed JSON, rate limiting) against a mocked
  SMTP transport — no real email is ever sent by the test suite.
- **Added CI** (`.github/workflows/ci.yml`): test → dependency audit, on
  every push/PR.
- **Added Dependabot** (`.github/dependabot.yml`): weekly PRs for npm and
  GitHub Actions dependencies.
- **Added JSDoc type-checking** (`tsconfig.json` + `npm run typecheck`):
  `// @ts-check` on `config.js`, `contact.schema.js`, and `mailer.js` — no
  TypeScript migration, zero runtime change.
- **Added `.editorconfig`** for consistent indentation across editors.
- Documented the new tests/CI and a Dependabot/audit-cadence expectation
  in `README.md`.

## Round 1 (2026-08-02) — external review findings, fixed and verified

- **`trust proxy` was never configured — fixed.** Without
  `app.set("trust proxy", ...)`, `express-rate-limit` throws
  `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` the moment a real request arrives
  behind a reverse proxy (Render/Railway/Fly.io all use one). Now
  configurable via `TRUST_PROXY_HOPS` (default `1`), with a `GET
  /debug/ip` route added to verify the correct value against the real
  host after deploying.
- **`ALLOWED_ORIGIN` only accepted one origin — fixed.** Now
  comma-separated and each entry validated as a URL, covering an apex +
  `www` domain or a staging URL coexisting with production.
- **CORS was mistakenly relied on as server-side access control — fixed.**
  CORS only controls whether a *browser* can read a response; a bare
  `curl` request with a spoofed `Origin` header still reached the route
  and sent a real email before this fix. Added `requireAllowedOrigin`
  middleware, applied to `POST /api/contact` specifically (not
  `/health`/`/debug/ip`, which non-browser tools need to reach without an
  `Origin` header).

## Initial template (2026-08-02)

- Express/Node contact-form API: zod-validated input, honeypot spam
  resistance (not schema-enforced, to avoid tipping off bots), per-route
  rate limiting, centralized error handling that never leaks internals in
  production, a 20kb body cap, and a fail-fast startup if SMTP is
  misconfigured.
- Caught and fixed during initial testing: `SMTP_SECURE` read from
  `.env` as the string `"false"` — `z.coerce.boolean()` would have parsed
  this as `true` (`Boolean("false") === true` in JS), silently forcing a
  TLS connection against a plain SMTP port. Fixed by parsing the literal
  strings `"true"`/`"false"` explicitly in `config.js`.
