import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { contactRouter } from "./routes/contact.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// Required for req.ip (and therefore the rate limiter) to see the real
// visitor's IP instead of the reverse proxy's, on every host this README
// recommends (Render/Railway/Fly.io all sit behind one). Without this,
// express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every
// request once deployed — see README's deployment checklist to verify the
// correct hop count for the actual host in use.
app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(
  cors({
    // ALLOWED_ORIGIN is parsed into an array in config.js (comma-separated
    // in .env) — locked to exactly that list, never "*", for an endpoint
    // that accepts POST data.
    origin: config.ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
  })
);
app.use(express.json({ limit: "20kb" })); // a contact form payload is tiny

// Most hosts (Render, Railway, Fly.io, uptime monitors...) expect a plain
// health check route to confirm the service is alive.
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

// Debug helper — visit this once after deploying to confirm TRUST_PROXY_HOPS
// is correct for the actual host: the "ip" value should match the real
// visitor's address (check via https://api.ipify.org from the same
// network), not the proxy's internal address. Safe to leave in place; it
// only ever echoes back information the visitor already has.
app.get("/debug/ip", (req, res) =>
  res.status(200).json({ ip: req.ip, xForwardedFor: req.headers["x-forwarded-for"] || null })
);

app.use("/api/contact", contactRouter);

// New feature areas follow the same shape: add a router under
// src/routes/, mount it here on its own path. Keep this file as the one
// place that lists every route the API exposes.

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler); // must be registered last
