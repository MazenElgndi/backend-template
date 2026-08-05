import { config } from "../config.js";

/**
 * CORS (the `cors` package) only controls whether a *browser* lets JS read
 * the response — it does not stop the request from reaching the server or
 * having side effects. A non-browser client (curl, a script) can send an
 * arbitrary Origin header and the request still goes through, CORS or not.
 *
 * Verified directly: a request with `Origin: http://evil.com` against this
 * project, with CORS configured "correctly," still triggered a real email
 * send — the browser would have blocked *reading the response*, but the
 * server had already done the work.
 *
 * Apply this to any route where that matters (state-changing, side-effect
 * endpoints like the contact form) — not to /health or /debug/ip, which
 * are meant to be reachable by non-browser tools (uptime monitors, curl)
 * that don't send an Origin header at all.
 */
export function requireAllowedOrigin(req, res, next) {
  const origin = req.headers.origin;

  if (!origin || !config.ALLOWED_ORIGIN.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  next();
}
