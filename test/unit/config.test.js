import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const childScript = path.join(__dirname, "..", "helpers", "loadConfigChild.mjs");

const VALID_ENV = {
  ALLOWED_ORIGIN: "https://client-site.com",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  MAIL_FROM: "no-reply@client-site.com",
  MAIL_TO: "owner@client-site.com",
};

// config.js validates process.env at import time and calls process.exit(1)
// on failure — so each case runs in its own child process. This also
// means every test here gets a clean env: no leakage between cases, and
// no risk of a failing case ending the actual test run.
function loadConfigWith(envOverrides) {
  return execFileAsync(process.execPath, [childScript], {
    env: { ...process.env, ...envOverrides },
  });
}

describe("config.js env parsing", () => {
  test("loads successfully with a complete, valid .env", async () => {
    const { stdout } = await loadConfigWith(VALID_ENV);
    const config = JSON.parse(stdout);
    assert.equal(config.ALLOWED_ORIGIN[0], "https://client-site.com");
    assert.equal(config.SMTP_HOST, "smtp.example.com");
  });

  test("exits non-zero when a required var is missing", async () => {
    const { SMTP_HOST, ...incomplete } = VALID_ENV;
    await assert.rejects(
      () => loadConfigWith(incomplete),
      /** @param {import("node:child_process").ExecFileException & { stderr: string }} err */
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /SMTP_HOST/);
        return true;
      }
    );
  });

  test("splits ALLOWED_ORIGIN on commas into an array", async () => {
    const { stdout } = await loadConfigWith({
      ...VALID_ENV,
      ALLOWED_ORIGIN: "https://client-site.com,https://www.client-site.com",
    });
    const config = JSON.parse(stdout);
    assert.deepEqual(config.ALLOWED_ORIGIN, [
      "https://client-site.com",
      "https://www.client-site.com",
    ]);
  });

  test("rejects a non-URL ALLOWED_ORIGIN entry", async () => {
    await assert.rejects(() =>
      loadConfigWith({ ...VALID_ENV, ALLOWED_ORIGIN: "not-a-url" })
    );
  });

  // Regression test for the exact bug this report references: naive
  // z.coerce.boolean() treats the *string* "false" as truthy, because
  // JS's Boolean("false") === true. config.js parses SMTP_SECURE with an
  // explicit enum + transform instead — this locks that fix in place.
  describe("SMTP_SECURE string-coercion regression", () => {
    test('the string "false" parses to boolean false', async () => {
      const { stdout } = await loadConfigWith({ ...VALID_ENV, SMTP_SECURE: "false" });
      assert.equal(JSON.parse(stdout).SMTP_SECURE, false);
    });

    test('the string "true" parses to boolean true', async () => {
      const { stdout } = await loadConfigWith({ ...VALID_ENV, SMTP_SECURE: "true" });
      assert.equal(JSON.parse(stdout).SMTP_SECURE, true);
    });

    test("defaults to false when omitted", async () => {
      const { SMTP_SECURE, ...withoutIt } = { ...VALID_ENV, SMTP_SECURE: undefined };
      const { stdout } = await loadConfigWith(withoutIt);
      assert.equal(JSON.parse(stdout).SMTP_SECURE, false);
    });

    test("rejects any value other than the literal strings true/false", async () => {
      await assert.rejects(() =>
        loadConfigWith({ ...VALID_ENV, SMTP_SECURE: "yes" })
      );
    });
  });

  test("PORT and numeric fields coerce from string to number", async () => {
    const { stdout } = await loadConfigWith({
      ...VALID_ENV,
      PORT: "4000",
      RATE_LIMIT_MAX_REQUESTS: "10",
    });
    const config = JSON.parse(stdout);
    assert.equal(config.PORT, 4000);
    assert.equal(typeof config.PORT, "number");
    assert.equal(config.RATE_LIMIT_MAX_REQUESTS, 10);
  });

  test("applies documented defaults when optional vars are omitted", async () => {
    const { stdout } = await loadConfigWith(VALID_ENV);
    const config = JSON.parse(stdout);
    assert.equal(config.PORT, 3001);
    assert.equal(config.TRUST_PROXY_HOPS, 1);
    assert.equal(config.SMTP_PORT, 587);
    assert.equal(config.RATE_LIMIT_WINDOW_MINUTES, 15);
    assert.equal(config.RATE_LIMIT_MAX_REQUESTS, 5);
  });

  test("rejects an invalid MAIL_FROM / MAIL_TO email format", async () => {
    await assert.rejects(() =>
      loadConfigWith({ ...VALID_ENV, MAIL_FROM: "not-an-email" })
    );
  });
});
