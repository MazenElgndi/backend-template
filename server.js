import { app } from "./src/app.js";
import { config } from "./src/config.js";
import { verifyMailer } from "./src/services/mailer.js";

async function start() {
  try {
    await verifyMailer();
    console.log("✅ SMTP connection verified");
  } catch (err) {
    console.error("❌ Could not connect to SMTP with the current .env values:");
    console.error(`   ${err.message}`);
    console.error("   Fix SMTP_* in .env, then restart. Refusing to start silently broken.");
    process.exit(1);
  }

  app.listen(config.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${config.PORT}`);
    console.log(`   Allowed origin (CORS): ${config.ALLOWED_ORIGIN}`);
  });
}

start();
