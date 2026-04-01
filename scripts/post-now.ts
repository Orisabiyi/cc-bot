// ═══════════════════════════════════════════════════
// Manual post trigger — run today's content NOW
// Usage: npm run post:now
// ═══════════════════════════════════════════════════

import { runNow } from "../src/services/scheduler.js";
import { disconnectDiscord } from "../src/services/discord.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  logger.info("Manual trigger: posting today's content...");
  await runNow();
  logger.info("Done! Disconnecting...");
  await disconnectDiscord();
  process.exit(0);
}

main().catch((err) => {
  logger.error("Manual post failed", { error: err.message });
  process.exit(1);
});
