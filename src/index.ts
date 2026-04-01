// ═══════════════════════════════════════════════════
// Common Chronicles Content Bot — Entry Point
// ═══════════════════════════════════════════════════
//
//  ╔═══════════════════════════════════════╗
//  ║   COMMON CHRONICLES CONTENT BOT      ║
//  ║   ─────────────────────────────────   ║
//  ║   Notion → Discord auto-poster       ║
//  ║   + cross-platform DM reminders      ║
//  ╚═══════════════════════════════════════╝
//
//  Flow:
//    1. Connect to Discord
//    2. Read Notion content calendar
//    3. Run scheduled jobs (cron)
//    4. Auto-post to Discord when content is due
//    5. DM you reminders for Twitter, LinkedIn, Instagram, etc.
//

import { initDiscord, disconnectDiscord } from "./services/discord.js";
import { startScheduler } from "./services/scheduler.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("═══════════════════════════════════════");
  logger.info("  Common Chronicles Content Bot v1.0");
  logger.info("═══════════════════════════════════════");

  try {
    // Step 1: Connect to Discord
    logger.info("Connecting to Discord...");
    await initDiscord();
    logger.info("✅ Discord connected");

    // Step 2: Start the scheduler
    startScheduler();

    logger.info("═══════════════════════════════════════");
    logger.info("  Bot is running! Waiting for cron triggers...");
    logger.info("  Press Ctrl+C to stop.");
    logger.info("═══════════════════════════════════════");
  } catch (error: any) {
    logger.error("Bot startup failed", { error: error.message });
    process.exit(1);
  }
}

// ─── Graceful shutdown ───
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await disconnectDiscord();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await disconnectDiscord();
  process.exit(0);
});

main();
