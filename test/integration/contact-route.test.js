import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { setTestEnv } from "../helpers/setTestEnv.js";

// config.js (imported transitively by app.js) validates process.env at
// import time, so required vars must exist before anything is imported.
setTestEnv();

// Replace nodemailer's transport with an in-memory fake before app.js (and
// therefore src/services/mailer.js) is imported, so no test here ever
// attempts a real network connection to an SMTP server. This mirrors the
// report's recommendation to use nodemailer's own jsonTransport for
// testing, without editing mailer.js to special-case "test mode".
const sentMail = [];
mock.module("nodemailer", {
  defaultExport: {
    createTransport: () => ({
      verify: async () => true,
      sendMail: async (mailOptions) => {
        sentMail.push(mailOptions);
        return { messageId: "test-message-id" };
      },
    }),
  },
});

const { app } = await import("../../src/app.js");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected server.listen(0) to bind a TCP port, got: " + address);
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const ORIGIN = "https://example.com"; // matches ALLOWED_ORIGIN in setTestEnv

/**
 * @param {object} body
 * @param {object} [opts]
 * @param {string|null} [opts.origin]
 * @param {string} [opts.rawBody] - send this exact string as the body instead of JSON.stringify(body)
 * @param {string} [opts.contentType]
 */
function postContact(body, { origin = ORIGIN, rawBody, contentType = "application/json" } = {}) {
  return fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      ...(origin ? { origin } : {}),
    },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
  });
}

const validSubmission = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello, I'd like to inquire about your services.",
};

describe("POST /api/contact", () => {
  test("valid submission -> 200 and an email is sent", async () => {
    sentMail.length = 0;
    const res = await postContact(validSubmission);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, { ok: true });
    assert.equal(sentMail.length, 1);
    assert.match(sentMail[0].text, /Ada Lovelace/);
    assert.equal(sentMail[0].replyTo, "ada@example.com");
  });

  test("invalid input -> 400 with field-level errors", async () => {
    const res = await postContact({ name: "A", email: "not-an-email", message: "short" });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, "Invalid request");
    const fields = json.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ["email", "message", "name"]);
  });

  test("honeypot filled -> 200 but no email sent", async () => {
    sentMail.length = 0;
    const res = await postContact({ ...validSubmission, website: "http://spam-bot.example" });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, { ok: true });
    assert.equal(sentMail.length, 0, "honeypot submissions must never send an email");
  });

  test("missing Origin header -> 403, no email sent", async () => {
    sentMail.length = 0;
    const res = await postContact(validSubmission, { origin: null });
    assert.equal(res.status, 403);
    assert.equal(sentMail.length, 0);
  });

  test("wrong Origin header -> 403, no email sent", async () => {
    sentMail.length = 0;
    const res = await postContact(validSubmission, { origin: "http://evil.com" });
    assert.equal(res.status, 403);
    assert.equal(sentMail.length, 0);
  });

  test("malformed JSON body -> 400, does not crash the server", async () => {
    const res = await postContact(undefined, { rawBody: "{ this is not json" });
    assert.equal(res.status, 400);

    // Confirm the server is still alive and serving normal requests.
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
  });

  test("rate limit -> 429 after the configured threshold", async () => {
    // setTestEnv sets RATE_LIMIT_MAX_REQUESTS=5. express-rate-limit keys
    // by req.ip, and every request in this test file comes from the same
    // loopback client, so this shares a bucket with tests above unless
    // it's the last test to run. Send enough requests to guarantee the
    // limit is exceeded regardless of prior usage in this file.
    let lastStatus;
    for (let i = 0; i < 10; i++) {
      const res = await postContact({ ...validSubmission, website: "trip-honeypot-not-count" });
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    assert.equal(lastStatus, 429);
  });
});
