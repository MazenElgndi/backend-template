// @ts-check
import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for backend configuration — mirrors the frontend's
 * `site.config.js` philosophy: one file to look at, everything else reads
 * from here. The difference is that secrets live in `.env` (never
 * committed) and this file just loads + validates them.
 *
 * Fails fast and loudly on startup if something required is missing,
 * instead of failing silently on the first real request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  // The frontend's real origin(s). Comma-separated if more than one (e.g.
  // the apex and "www" both resolve, or a staging URL needs to coexist
  // with production): "https://client-site.com,https://www.client-site.com".
  // CORS is locked to exactly this list — never wildcard "*" for an
  // endpoint that accepts POST data.
  ALLOWED_ORIGIN: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),

  // Number of reverse-proxy hops between the internet and this process
  // (Render/Railway/Fly.io-style single proxy = 1). Required for both
  // `req.ip` and the rate limiter to see the real visitor's IP instead of
  // the proxy's — see README's deployment checklist. Verify the correct
  // value per host rather than assuming 1 is always right; test via the
  // /debug/ip route described there.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  // Standard SMTP — works with any provider (Gmail, Zoho, Resend,
  // SendGrid, Mailgun, Amazon SES, a client's existing business email...)
  // without locking this template to one vendor's SDK.
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // NOTE: z.coerce.boolean() would treat the *string* "false" as truthy
  // (JS's Boolean("false") === true) — that's a real, easy-to-miss bug for
  // any boolean env var, not just this one. Parse explicitly instead.
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),

  MAIL_FROM: z.string().email(),
  MAIL_TO: z.string().email(),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("\n❌ Invalid or missing environment variables:\n");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("\nCheck .env against .env.example, then restart.\n");
    process.exit(1);
  }

  return parsed.data;
}

export const config = loadConfig();
