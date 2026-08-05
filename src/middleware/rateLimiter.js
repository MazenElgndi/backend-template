import rateLimit from "express-rate-limit";
import { config } from "../config.js";

/**
 * Limits how many times a single IP can hit an endpoint in a time window.
 * Applied to the contact route specifically (see routes/contact.js) —
 * import and apply this to any new route that accepts public write
 * traffic, rather than a single blanket limiter for the whole app.
 */
export const contactRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
