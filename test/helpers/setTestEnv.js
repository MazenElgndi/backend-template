// Populates process.env with the minimum set of variables config.js
// requires, so tests can import src/config.js (and anything that imports
// it) without a real .env file. Call this BEFORE importing app.js/config.js
// in any test file — config.js validates process.env at import time.
//
// Never overwrites a value the environment (or a test) already set, so an
// individual test can override one field (e.g. NODE_ENV) beforehand.
export function setTestEnv(overrides = {}) {
  const defaults = {
    NODE_ENV: "test",
    // NOT "0" — config.js's schema requires PORT to be positive, so "0"
    // fails validation before any test even runs. The "let the OS assign
    // a free port" trick lives in the integration test's own
    // `app.listen(0)` call, which never reads this env var at all — this
    // value just needs to be *a* valid port for config.js to accept.
    PORT: "3999",
    ALLOWED_ORIGIN: "https://example.com",
    TRUST_PROXY_HOPS: "1",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "test-user",
    SMTP_PASS: "test-pass",
    MAIL_FROM: "no-reply@example.com",
    MAIL_TO: "owner@example.com",
    RATE_LIMIT_WINDOW_MINUTES: "15",
    RATE_LIMIT_MAX_REQUESTS: "5",
  };

  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    process.env[key] = value;
  }
}
