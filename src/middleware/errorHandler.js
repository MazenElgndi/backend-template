import { ZodError } from "zod";
import { config } from "../config.js";

/**
 * Central error handler — every route in this project can just `throw`
 * (Express 5 forwards async errors here automatically, no try/catch
 * boilerplate needed per route). Keeps error responses consistent and
 * makes sure raw internal error details never leak to the client.
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  console.error(err);

  res.status(err.statusCode || 500).json({
    error: "Something went wrong. Please try again shortly.",
    // Only surface real error details outside production — never leak
    // internals (stack traces, SMTP errors, etc.) to a live client.
    ...(config.NODE_ENV !== "production" && { debug: err.message }),
  });
}
