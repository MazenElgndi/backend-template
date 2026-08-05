# Security Notes — Backend

Last checked: 2026-08-02 (`npm audit` + full manual endpoint testing, both below)

## `npm audit`: 0 vulnerabilities
Fresh install, all dependencies current as of this date (`express@5.2.1`, `helmet@8.3.0`, `express-rate-limit@8.6.1`, `nodemailer@9.0.3`, `zod@4.4.3`, `cors@2.8.6`, `dotenv@17.4.2`).

## Design decisions and why

**CORS is locked to `ALLOWED_ORIGIN`, never `*`.** Verified directly: a request sent with `Origin: http://evil-site.com` still gets back `Access-Control-Allow-Origin: <the real configured origin>`, not a reflection of the request's own origin and not a wildcard. A browser enforces this even though a raw `curl` request doesn't — this only protects real browser clients, which is the actual threat model for a public form endpoint.

**Rate limiting is per-route, not global.** `contactRateLimiter` is applied to `POST /api/contact` specifically (default: 5 requests / 15 minutes per IP). Confirmed a 4th rapid request returns `429` with the configured limit. Apply the same pattern — a dedicated limiter per route — to any new public write endpoint; don't share one limiter across unrelated routes with different abuse profiles.

**Honeypot field, not a CAPTCHA.** `website` is a hidden field a human never sees or fills (see `FRONTEND-INTEGRATION.md`); a non-empty value is almost certainly a bot filling every input blindly. Deliberately **not** enforced as a schema constraint (e.g. `max(0)`) — that would return `400` and hand the bot a signal that the field is being checked. Instead the schema accepts any value, and the route silently returns a fake `200 OK` with no email sent. Verified: submitting with `website` filled returns `200`, and the receiving mailbox gets nothing.

**Input validation errors ≠ generic 500s.** Zod errors are caught centrally in `errorHandler.js` and returned as `400` with a field-by-field breakdown (`{"field": "email", "message": "..."}`), not a raw stack trace. Confirmed with three simultaneous invalid fields — all three came back in one response, not just the first.

**Internal error details never reach the client in production.** `errorHandler.js` only includes the real `err.message` in the response when `NODE_ENV !== "production"`. In production, a caller gets a generic message and nothing else — SMTP errors, stack traces, or internal paths never leak. Set `NODE_ENV=production` on the real deployment.

**The server refuses to start if SMTP is misconfigured**, rather than starting cleanly and failing silently on the client's first real form submission days later. `server.js` calls `verifyMailer()` before binding the port.

**Body size is capped at 20kb.** A contact form payload is tiny; this is deliberately restrictive, not a generic API default. Confirmed a 25kb payload is rejected with `413` and the server keeps serving requests afterward — it doesn't affect anything else.

**Malformed JSON doesn't crash the process.** Confirmed directly: a broken JSON body returns `400` via the same central error handler, and a follow-up request immediately after still succeeds.

## A real bug this testing caught (worth knowing, not just the result)
`SMTP_SECURE` is read from `.env` as the **string** `"false"`. An earlier draft used `z.coerce.boolean()` to parse it — but `Boolean("false")` evaluates to `true` in JavaScript, because *any* non-empty string is truthy. That silently forced a secure/TLS connection attempt against a plain SMTP port and broke mail delivery in a way that only showed up as a confusing low-level TLS error, not a validation error. Fixed by parsing the literal strings `"true"`/`"false"` explicitly (`src/config.js`). Worth remembering for **any** boolean environment variable in any project — `z.coerce.boolean()` on env vars is very rarely what you actually want.

## Things intentionally out of scope for this base
- **CSRF tokens** — not applicable here; this API only accepts `application/json` from a locked CORS origin, and issues no session cookies for the CSRF-vulnerable pattern (cookie-based auth) to apply to. Revisit if a future feature adds cookie-based sessions.
- **CAPTCHA / third-party bot-detection** — the honeypot covers unsophisticated bots for free, with no external dependency or API key. If spam becomes a real problem for a specific client, add a CAPTCHA provider on top rather than replacing this.
- **Persistent storage of submissions** — this base is deliberately email-only. Adding a database is a natural Flagship-tier extension (see `README.md`), not assumed here.

## Round 3 — external review findings, fixed and verified

An independent audit of the whole template system (frontend + backend + build brief) flagged two real, concrete gaps in this project. Both fixed and tested directly, not just patched and assumed working:

**`trust proxy` was never configured — fixed.** All three hosts this README recommends (Render, Railway, Fly.io) sit behind a reverse proxy. Without `app.set("trust proxy", ...)`, `express-rate-limit@8.6.1` specifically **throws `ValidationError: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`** the moment a real request arrives with an `X-Forwarded-For` header — verified directly by sending a request with that header before the fix (it threw) and after (it didn't). This means the practical failure mode is *louder* than "rate limiting silently breaks" — it's "the contact form starts returning 500 to every real visitor the moment it's deployed behind a proxy" — which would very likely get caught in first-day testing, but is still a hard blocker, not a subtle drift. Now configurable via `TRUST_PROXY_HOPS` (default `1`), with a `GET /debug/ip` route added specifically to verify the correct value against the real host after deploying (see README's deployment checklist) — don't trust the default blindly.

**`ALLOWED_ORIGIN` only accepted one origin — fixed.** Now comma-separated (`config.js` parses and validates each as a URL), covering the common case of an apex + `www` domain, or a staging URL that needs to coexist with production.

**A third issue, found by testing the fix above, not by the external review:** CORS (the `cors` package) only controls whether a *browser* is allowed to read the response — it does not stop the request from reaching the server or having side effects, and does not stop non-browser clients at all. Verified directly: before this fix, a request built with `curl` and an `Origin: http://evil.com` header — no browser involved — still reached the route and **sent a real email**, despite `ALLOWED_ORIGIN` being configured "correctly." CORS was never designed to be a server-side access control, and treating it as one is a common, easy mistake. Fixed with an explicit `requireAllowedOrigin` middleware (`src/middleware/requireAllowedOrigin.js`) that rejects with `403` server-side, applied to `POST /api/contact` specifically — not globally, since `/health` and `/debug/ip` are meant to be reachable by non-browser tools that don't send an `Origin` header at all. Apply the same middleware to any future route where a side effect (sending mail, writing data) shouldn't be triggerable by a bare HTTP request from outside a browser.

All of the above re-verified after fixing: full regression pass (valid submission, invalid input, honeypot, malformed JSON, oversized payload, rate limit) still behaves exactly as documented above, plus `npm audit` still at 0 vulnerabilities.

## Round 3 — test infrastructure itself had real bugs, found by actually running it

A prior session added the test suite and CI workflow referenced in `CHANGELOG.md`'s Round 2, but couldn't run any of it (no code execution available). This round is that first real run — and it surfaced genuine bugs in the *test setup*, not the application code:

- **`test/helpers/loadConfigChild.mjs` was being executed directly by `node --test`'s default discovery** (`node --test` treats *any* `.js`/`.mjs` file inside a directory literally named `test` as a candidate test file, regardless of its own name) — it failed immediately since it wasn't given the env overrides it expects when invoked correctly. Fixed by scoping the `"test"` script to explicit globs (`test/unit/**/*.test.js test/integration/**/*.test.js`), which excludes the helpers directory entirely.
- **`setTestEnv.js` set `PORT: "0"`**, intending to let the OS pick a free port — but that trick actually lives in the integration test's own `app.listen(0)` call, which never reads this env var. Meanwhile `config.js`'s schema requires `PORT` to be `positive()`, so `"0"` failed validation and crashed the entire integration suite at import time. Fixed by using a normal placeholder port value here instead.
- **`jsconfig.json` was never picked up by `tsc`** — that filename is a VS Code editor convention for JS IntelliSense; the TypeScript compiler itself only auto-discovers `tsconfig.json`. `npm run typecheck` was silently doing nothing (though it did still exit non-zero, so this wouldn't have shown as a false-pass in CI — just a useless check). Renamed to `tsconfig.json`; this immediately surfaced 5 real type mismatches in the test files (a `server.address()` narrowing issue, an undocumented `rawBody` option, and two `unknown`-typed catch parameters), all fixed with either a real runtime guard (the `server.address()` case — genuinely better code, not just a type-checker workaround) or proper JSDoc parameter types.

`npm test`: 33/33 passing (was 27/29, two of which weren't even reachable before these fixes). `npm run typecheck`: 0 errors (was silently checking nothing). `npm audit`: unchanged, 0 vulnerabilities.
