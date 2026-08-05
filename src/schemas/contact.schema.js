// @ts-check
import { z } from "zod";

/**
 * Validates the contact form payload. Add new form fields here — this is
 * the one place a future field (e.g. "phone", "budget") needs to be
 * declared; the route and the email template both read from this shape.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .min(10, "Message is too short")
    .max(5000, "Message is too long"),

  // Honeypot field. The real frontend form hides this from human visitors
  // with CSS (see FRONTEND-INTEGRATION.md) — only bots that blindly fill
  // every input end up sending a value here.
  //
  // Deliberately NOT constrained here (e.g. max(0)) — a schema rejection
  // would return 400, tipping the bot off that this field is being
  // checked. Accepting any value and handling it in the route (silent
  // fake-success, no email) keeps the bot none the wiser.
  website: z.string().optional(),
});
