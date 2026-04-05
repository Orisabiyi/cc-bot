// ═══════════════════════════════════════════════════
// Scheduler Service — Cron-based content automation
// ═══════════════════════════════════════════════════
//
// Runs daily checks against your Notion content calendar
// and dispatches actions:
//   - Discord posts → auto-posted
//   - Twitter/LinkedIn/Instagram → DM reminder with pre-written copy
//   - Events → announcement posted + reminder sent
//
// Schedule (all times WAT — Africa/Lagos):
//   08:00 — Morning check: send reminders for today's content
//   09:00 — Auto-post: publish Discord content
//   18:00 — Evening check: reminder for tomorrow's content

import cron from "node-cron";
import dayjs from "dayjs";
import {
  getTodaysContent,
  getUpcomingEvents,
  getContentForDateRange,
  markAsPosted,
  markAsFailed,
} from "./notion.js";
import {
  postToDiscord,
  sendReminder,
  initDiscord,
} from "./discord.js";
import type { ContentItem, ReminderPayload } from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { generateWeeklyPlan } from "./content-pipeline.js";

// ═══════════════════════════════════════════════════
// Process today's content items
// ═══════════════════════════════════════════════════

async function processDailyContent(): Promise<void> {
  logger.info("═══ Running daily content check ═══");

  try {
    const todaysItems = await getTodaysContent();

    if (todaysItems.length === 0) {
      logger.info("No content scheduled for today");
      return;
    }

    logger.info(`Found ${todaysItems.length} items for today`);

    for (const item of todaysItems) {
      await processContentItem(item);
    }
  } catch (error: any) {
    logger.error("Daily content check failed", { error: error.message });
  }
}

// ═══════════════════════════════════════════════════
// Process a single content item
// ═══════════════════════════════════════════════════

async function processContentItem(item: ContentItem): Promise<void> {
  logger.info(`Processing: ${item.title} (${item.platform})`);

  switch (item.platform) {
    // ─── Auto-post to Discord ───
    case "discord": {
      const result = await postToDiscord(item);
      if (result.success) {
        logger.info(`✅ Posted to Discord: ${item.title}`);
        await markAsPosted(item.notionPageId);
      } else {
        logger.error(`❌ Discord post failed: ${result.error}`);
        await markAsFailed(item.notionPageId, result.error || "Unknown error");
      }
      break;
    }

    // ─── Send DM reminder for manual platforms ───
    case "twitter":
    case "linkedin":
    case "instagram":
    case "whatsapp":
    case "medium":
    case "substack":
    case "hashnode": {
      const reminder: ReminderPayload = {
        platform: item.platform,
        content: item.content,
        scheduledDate: item.scheduledDate,
        action: item.tags?.length ? "event" : "post",
        eventName: item.tags?.[0],
      };
      const result = await sendReminder(reminder);
      if (result.success) {
        logger.info(`✅ Sent ${item.platform} reminder via DM`);
      } else {
        logger.error(`❌ Reminder failed: ${result.error}`);
      }
      break;
    }

    default:
      logger.warn(`Unknown platform: ${item.platform}`);
  }
}

// ═══════════════════════════════════════════════════
// Send evening preview of tomorrow's content
// ═══════════════════════════════════════════════════

async function sendTomorrowPreview(): Promise<void> {
  logger.info("═══ Sending tomorrow's content preview ═══");

  try {
    const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
    const tomorrowItems = await getContentForDateRange(tomorrow, tomorrow);

    if (tomorrowItems.length === 0) {
      logger.info("Nothing scheduled for tomorrow");
      return;
    }

    // Build a summary message
    const summary = tomorrowItems
      .map((item) => {
        const emoji =
          item.platform === "twitter"
            ? "🐦"
            : item.platform === "linkedin"
              ? "💼"
              : item.platform === "instagram"
                ? "📸"
                : item.platform === "discord"
                  ? "💬"
                  : "📌";
        return `${emoji} **${capitalize(item.platform)}** — ${truncate(item.content, 80)}`;
      })
      .join("\n");

    const reminder: ReminderPayload = {
      platform: "discord",
      content: `📋 **Tomorrow's Content Queue (${tomorrow})**\n\n${summary}`,
      scheduledDate: tomorrow,
      action: "review",
    };

    await sendReminder(reminder);
    logger.info(`Sent preview for ${tomorrowItems.length} items`);
  } catch (error: any) {
    logger.error("Tomorrow preview failed", { error: error.message });
  }
}

// ═══════════════════════════════════════════════════
// Weekly events digest (sent Sunday evening)
// ═══════════════════════════════════════════════════

async function sendWeeklyDigest(): Promise<void> {
  logger.info("═══ Sending weekly events digest ═══");

  try {
    const events = await getUpcomingEvents(7);

    if (events.length === 0) {
      logger.info("No events in the next 7 days");
      return;
    }

    const digest = events
      .map((e) => `🎙️ **${e.title}** — ${e.scheduledDate}`)
      .join("\n");

    const reminder: ReminderPayload = {
      platform: "discord",
      content: `📅 **This Week's Events**\n\n${digest}\n\nMake sure everything is prepped!`,
      scheduledDate: dayjs().format("YYYY-MM-DD"),
      action: "review",
    };

    await sendReminder(reminder);
  } catch (error: any) {
    logger.error("Weekly digest failed", { error: error.message });
  }
}

// ═══════════════════════════════════════════════════
// Start all scheduled jobs
// ═══════════════════════════════════════════════════

export function startScheduler(): void {
  logger.info("Starting scheduler with Africa/Lagos timezone");

  // ─── 08:00 WAT — Morning reminders ───
  cron.schedule(
    "0 8 * * *",
    async () => {
      logger.info("⏰ 08:00 — Morning content check");
      await processDailyContent();
    },
    { timezone: config.timezone }
  );

  // ─── 09:00 WAT — Auto-post Discord content ───
  cron.schedule(
    "0 9 * * *",
    async () => {
      logger.info("⏰ 09:00 — Auto-posting Discord content");
      const todaysItems = await getTodaysContent();
      const discordItems = todaysItems.filter((i) => i.platform === "discord");
      for (const item of discordItems) {
        await postToDiscord(item);
      }
    },
    { timezone: config.timezone }
  );

  // ─── 20:00 WAT — Evening preview of tomorrow ───
  cron.schedule(
    "0 20 * * *",
    async () => {
      logger.info("⏰ 20:00 — Tomorrow's content preview");
      await sendTomorrowPreview();
    },
    { timezone: config.timezone }
  );

  // ─── Sunday 19:00 WAT — Weekly digest ───
  cron.schedule(
    "0 19 * * 0",
    async () => {
      logger.info("⏰ Sunday 19:00 — Weekly digest");
      await sendWeeklyDigest();
    },
    { timezone: config.timezone }
  );

  // ─── Sunday 10:00 WAT — Auto-generate next week's content ───
  cron.schedule(
    "0 1 * * 1",
    async () => {
      logger.info("⏰ Sunday 10:00 — Generating next week's content");
      try {
        const result = await generateWeeklyPlan();
        logger.info(
          `Generated ${result.savedCount} content drafts for the week`
        );

        // Notify you via DM that new drafts are ready
        const reminder: ReminderPayload = {
          platform: "discord",
          content: `🧠 **Weekly Content Generated**\n\n${result.savedCount} new drafts have been added to your Content Pipeline in Notion.\n\nTopics:\n${result.ideas
            .map((i) => `→ ${i.topic} (${i.platforms.join(", ")})`)
            .join("\n")}\n\nReview them, tweak the voice, and flip to "Ready" when approved.`,
          scheduledDate: dayjs().format("YYYY-MM-DD"),
          action: "review",
        };
        await sendReminder(reminder);
      } catch (error: any) {
        logger.error("Weekly content generation failed", {
          error: error.message,
        });
      }
    },
    { timezone: config.timezone }
  );

  logger.info("✅ All cron jobs registered");
  logger.info("  → 08:00 WAT — Morning reminders (all platforms)");
  logger.info("  → 09:00 WAT — Auto-post to Discord");
  logger.info("  → 20:00 WAT — Tomorrow's content preview DM");
  logger.info("  → Sunday 19:00 WAT — Weekly events digest");
  logger.info("  → Sunday 10:00 WAT — AI content generation (weekly)");
}

// ═══════════════════════════════════════════════════
// Manual trigger (for testing)
// ═══════════════════════════════════════════════════

export async function runNow(): Promise<void> {
  await initDiscord();
  await processDailyContent();
}

// Helpers
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 3) + "..." : str;
}
