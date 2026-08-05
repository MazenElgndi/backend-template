import { Router } from "express";
import { contactSchema } from "../schemas/contact.schema.js";
import { sendContactEmail } from "../services/mailer.js";
import { contactRateLimiter } from "../middleware/rateLimiter.js";
import { requireAllowedOrigin } from "../middleware/requireAllowedOrigin.js";

export const contactRouter = Router();

contactRouter.post("/", requireAllowedOrigin, contactRateLimiter, async (req, res) => {
  const data = contactSchema.parse(req.body); // throws ZodError -> errorHandler

  // Honeypot tripped: pretend success so the bot doesn't learn anything,
  // but never actually send an email.
  if (data.website) {
    return res.status(200).json({ ok: true });
  }

  await sendContactEmail(data);

  res.status(200).json({ ok: true });
});
