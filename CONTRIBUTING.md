# Contributing to this template

This is a reusable **template** — changes here affect every future
client project built from it. If you're deploying it for a specific
client, see `README.md`'s Setup/Deployment checklist sections instead;
almost none of that belongs here.

## Adding a new route

1. Create a schema under `src/schemas/` (see `contact.schema.js` for the
   shape — zod, one field per line, comments explaining anything
   non-obvious like the honeypot's deliberately-unconstrained `website`
   field).
2. Create the route under `src/routes/` (see `contact.js`). Apply
   `requireAllowedOrigin` and a dedicated rate limiter (see
   `rateLimiter.js`) to any route that has a side effect (sends mail,
   writes data) — don't share one limiter across routes with different
   abuse profiles.
3. Mount it in `src/app.js`, in the section that lists every route the
   API exposes. Routes can `throw` directly — Express 5 forwards async
   errors to `errorHandler.js` automatically.

## Adding a new service (e.g. a different notification channel)

Follow `mailer.js`'s shape: a small module under `src/services/`, reading
its config from `src/config.js` (never `process.env` directly — that's
`config.js`'s job, and it's what validates required vars fail loudly at
startup).

## Before opening a PR against this template

- `npm test` — must pass. Add unit tests for new pure logic
  (`test/unit/`) and integration tests for any new endpoint
  (`test/integration/`), following the existing pattern of mocking
  `nodemailer` rather than sending real email in tests.
- `npm run typecheck` — should stay clean for any file that already has
  `// @ts-check` at the top. Adding the pragma to a new file is welcome,
  but budget time to fix what it surfaces.
- If you touched a dependency, re-run `npm audit` and update
  `SECURITY-NOTES.md` if the finding set changed.
- Update `CHANGELOG.md` with what changed and why.
