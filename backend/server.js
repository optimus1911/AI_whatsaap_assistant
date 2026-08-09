import dotenv from "dotenv";
dotenv.config();

import { execSync } from 'child_process';
import app from './app.js';
import connectDB from './config/db.js';
import { seedCatalogAndKnowledge } from './scripts/seedProducts.js';

let appVersion = process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.substring(0, 7) : 'v2.1.0-rag';
try {
  const gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  if (gitSha) appVersion = gitSha;
} catch {
  // Use fallback
}

process.env.APP_VERSION = appVersion;
console.log(`[AI-WA-Assistant] Version: ${appVersion}`);
console.log("Gemini:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("Mongo :", process.env.MONGODB_URI ? "Loaded ✅" : "Missing ❌");
console.log("WA Token:", process.env.WHATSAPP_ACCESS_TOKEN ? "Loaded ✅" : "Missing ❌");

const PORT = process.env.PORT || 5000;

// === CRITICAL: Bind HTTP server FIRST so Render detects the open port ===
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] AI WhatsApp Assistant listening on port ${PORT} (0.0.0.0) [Version: ${appVersion}]`);
});

// === THEN initialize async services (MongoDB, seed) — failures won't block the port ===
(async () => {
  try {
    await connectDB();
    console.log('[SERVER] MongoDB initialization complete');
  } catch (err) {
    console.error(`[SERVER] MongoDB initialization error: ${err.message}`);
    console.warn('[SERVER] Continuing with deterministic fallback catalog');
  }

  try {
    await seedCatalogAndKnowledge();
    console.log('[SERVER] Catalog seed complete');
  } catch (err) {
    console.warn('[SERVER] Initial product/knowledge auto-seed notice:', err.message);
  }
})();

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  server.close(() => process.exit(1));
});
