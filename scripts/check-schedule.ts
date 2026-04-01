// ═══════════════════════════════════════════════════
// Schedule checker — preview upcoming content
// Usage: npm run check
// ═══════════════════════════════════════════════════

import dayjs from "dayjs";
import { getContentForDateRange, getUpcomingEvents } from "../src/services/notion.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  const today = dayjs().format("YYYY-MM-DD");
  const weekEnd = dayjs().add(7, "day").format("YYYY-MM-DD");

  logger.info(`\n📅 Content scheduled from ${today} to ${weekEnd}:\n`);

  const items = await getContentForDateRange(today, weekEnd);

  if (items.length === 0) {
    logger.info("No content scheduled for this period.");
    return;
  }

  // Group by date
  const grouped = items.reduce(
    (acc, item) => {
      if (!acc[item.scheduledDate]) acc[item.scheduledDate] = [];
      acc[item.scheduledDate].push(item);
      return acc;
    },
    {} as Record<string, typeof items>
  );

  for (const [date, dateItems] of Object.entries(grouped)) {
    const dayName = dayjs(date).format("dddd");
    console.log(`\n━━━ ${dayName}, ${date} ━━━`);
    for (const item of dateItems) {
      const emoji =
        item.platform === "twitter"
          ? "🐦"
          : item.platform === "linkedin"
          ? "💼"
          : item.platform === "instagram"
          ? "📸"
          : item.platform === "discord"
          ? "💬"
          : item.platform === "whatsapp"
          ? "📱"
          : "📌";
      const preview = item.content.substring(0, 60).replace(/\n/g, " ");
      console.log(`  ${emoji} ${item.platform.padEnd(12)} → ${preview}...`);
    }
  }

  // Events
  const events = await getUpcomingEvents(7);
  if (events.length > 0) {
    console.log("\n🎙️ Upcoming Events:");
    for (const event of events) {
      console.log(`  → ${event.title} on ${event.scheduledDate}`);
    }
  }
}

main().catch((err) => {
  logger.error("Schedule check failed", { error: err.message });
  process.exit(1);
});
