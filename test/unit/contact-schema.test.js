import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contactSchema } from "../../src/schemas/contact.schema.js";

describe("contactSchema", () => {
  test("accepts a valid submission", () => {
    const result = contactSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello, I'd like to inquire about your services.",
    });
    assert.equal(result.name, "Ada Lovelace");
    assert.equal(result.email, "ada@example.com");
    assert.equal(result.website, undefined);
  });

  test("trims whitespace on name, email, and message", () => {
    const result = contactSchema.parse({
      name: "  Ada  ",
      email: "  ada@example.com ",
      message: "  A message that is long enough.  ",
    });
    assert.equal(result.name, "Ada");
    assert.equal(result.email, "ada@example.com");
    assert.equal(result.message, "A message that is long enough.");
  });

  test("accepts an honeypot value without rejecting (bots must not learn it's checked)", () => {
    const result = contactSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello, I'd like to inquire about your services.",
      website: "http://spam-bot.example",
    });
    assert.equal(result.website, "http://spam-bot.example");
  });

  describe("rejects invalid input with the right field", () => {
    const valid = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello, I'd like to inquire about your services.",
    };

    test("name too short", () => {
      const result = contactSchema.safeParse({ ...valid, name: "A" });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "name");
    });

    test("name too long", () => {
      const result = contactSchema.safeParse({ ...valid, name: "A".repeat(101) });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "name");
    });

    test("missing name", () => {
      const { name, ...rest } = valid;
      const result = contactSchema.safeParse(rest);
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "name");
    });

    test("invalid email format", () => {
      const result = contactSchema.safeParse({ ...valid, email: "not-an-email" });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "email");
    });

    test("message too short", () => {
      const result = contactSchema.safeParse({ ...valid, message: "short" });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "message");
    });

    test("message too long", () => {
      const result = contactSchema.safeParse({ ...valid, message: "A".repeat(5001) });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[0], "message");
    });
  });
});
