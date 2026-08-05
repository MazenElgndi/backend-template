# Backend Template

A small, self-contained Node.js/Express API. Ships with one working endpoint
— a contact-form mailer — built to the same standard as `business-template`
(the frontend): real dependency hygiene, tested (not just written) security
behavior, and a structure meant to be extended by an AI or a freelancer
without having to guess where things go.

## Why Express, plain Node, and SMTP (not a specific vendor SDK)

- **Express** has the deepest, most consistent footprint of any Node
  framework across AI models and documentation — directly relevant if an
  AI is going to be the one extending this later.
- **A plain Node server**, not a specific platform's serverless function
  format (Vercel/Netlify functions, etc.) — stays portable. Deploy it
  as-is to Render, Railway, Fly.io, a VPS, or wrap it for serverless later
  if a specific host needs that; the code itself isn't locked to one
  vendor's conventions.
- **SMTP via Nodemailer**, not a provider-specific SDK (Resend, SendGrid,
  etc.) — works with literally any provider, including a client's
  existing business email, by changing `.env` values only. No code
  change, no vendor lock-in, no signup required just to read the code.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run dev             # http://localhost:3001, auto-restarts on change
```

`server.js` verifies the SMTP connection before it starts listening — if
`.env` is wrong, you'll get a clear error immediately, not a silent
failure the first time a real visitor submits the form.

## Folder structure — the pattern to follow when extending this

```
server.js                    entry point: verifies mail, starts listening
src/
  app.js                     the ONE place every route gets mounted
  config.js                  reads + validates all of .env, fails fast if wrong
  routes/contact.js          example route — copy this shape for new ones
  schemas/contact.schema.js  zod validation — one file per route's input shape
  services/mailer.js         SMTP logic, isolated from the route itself
  middleware/
    rateLimiter.js           apply per-route, not globally (see comments)
    errorHandler.js          registered once in app.js, last
  utils/escapeHtml.js        sanitizes any user text before it's used in HTML
```

**To add a new route** (e.g. a newsletter signup): create
`src/schemas/newsletter.schema.js` (validation), `src/routes/newsletter.js`
(the route, following `contact.js`'s shape), mount it in `app.js` next to
the existing `app.use("/api/contact", ...)` line. Routes in this project
can `throw` directly — Express 5 forwards async errors to `errorHandler.js`
automatically, no manual `try/catch` needed in every handler.

## What's deliberately NOT in this base
See `SECURITY-NOTES.md` → "Things intentionally out of scope." Short
version: no database, no auth, no CAPTCHA — this is the Standard-tier
foundation (a working contact form, done properly). A Flagship-tier
extension (admin panel, dynamic content, a real database) builds on top
of this same `routes/` + `schemas/` + `services/` pattern; it doesn't
require restructuring what's already here.

## Connecting this to the frontend
See `FRONTEND-INTEGRATION.md`. Short version: set `ALLOWED_ORIGIN` in this
project's `.env` to the frontend's real deployed URL, and set
`VITE_CONTACT_API_URL` in the frontend's `.env` to this API's real
deployed URL. The frontend's `Contact.jsx` already calls it — see that
file for the actual `fetch` call.

## Deployment checklist
- Set every `.env` value for real (`ALLOWED_ORIGIN` = frontend's actual
  domain(s), real SMTP credentials, `NODE_ENV=production`).
- **Verify `TRUST_PROXY_HOPS` against the actual host**, not just the
  default. After deploying, visit `GET /debug/ip` on the real deployed URL
  (not localhost) and confirm the `ip` field matches your own real address
  (check it independently via `https://api.ipify.org`). If it shows an
  internal/proxy address instead, increase `TRUST_PROXY_HOPS` by one and
  redeploy. Getting this wrong doesn't fail loudly at startup — it silently
  breaks the rate limiter (everyone sharing one bucket, or the limit being
  trivially bypassable), so don't skip this even though the app runs fine
  without it.
- `npm audit` before each deploy — see `SECURITY-NOTES.md` for the last
  recorded result and how to judge a new finding.
- Confirm the health check (`GET /health`) is reachable — most hosts
  (Render, Railway, Fly.io) use this to know the service is alive.

## Testing and CI
`npm test` runs unit tests (`test/unit/`, covering `escapeHtml.js`,
`contact.schema.js`, and `config.js`'s env parsing) and integration tests
(`test/integration/`, covering the full `POST /api/contact` behavior
against a mocked SMTP transport — no real email is ever sent by the test
suite). `.github/workflows/ci.yml` runs this plus `npm audit` on every
push/PR.

## Who monitors dependencies after handoff
Dependabot opens a weekly PR for any outdated dependency
(`.github/dependabot.yml`) — it never merges anything itself. Aim to
triage those PRs within a week; the CI workflow above runs against each
one automatically, so a bad update gets caught before merge. Beyond that,
re-run `npm audit` and update `SECURITY-NOTES.md` at least once per
client re-delivery, not just at initial handoff.
