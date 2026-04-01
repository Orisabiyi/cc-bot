// ═══════════════════════════════════════════════════
// Config loader — validates env vars at startup
// ═══════════════════════════════════════════════════

import "dotenv/config";
import type { BotConfig } from "../types/index.js";

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config: BotConfig = {
  notion: {
    apiKey: required("NOTION_API_KEY"),
    contentCalendarPageId: required("NOTION_CONTENT_DB_ID"),
  },
  discord: {
    botToken: required("DISCORD_BOT_TOKEN"),
    guildId: required("DISCORD_GUILD_ID"),
    channels: {
      // info
      rules: optional("DISCORD_CHANNEL_RULES", ""),
      "moderator-only": optional("DISCORD_CHANNEL_MODERATOR_ONLY", ""),
      // Start Here
      welcome: optional("DISCORD_CHANNEL_WELCOME", ""),
      introductions: optional("DISCORD_CHANNEL_INTRODUCTIONS", ""),
      "pick-your-role": optional("DISCORD_CHANNEL_PICK_YOUR_ROLE", ""),
      // community (core — bot posts here most often)
      general: required("DISCORD_CHANNEL_GENERAL"),
      showcase: optional("DISCORD_CHANNEL_SHOWCASE", ""),
      "off-topic": optional("DISCORD_CHANNEL_OFF_TOPIC", ""),
      // updates
      announcements: required("DISCORD_CHANNEL_ANNOUNCEMENTS"),
      "podcast-blog": optional("DISCORD_CHANNEL_PODCAST_BLOG", ""),
      // programs (core — events post here)
      "story-circles": required("DISCORD_CHANNEL_STORY_CIRCLES"),
      "global-spotlights": optional("DISCORD_CHANNEL_GLOBAL_SPOTLIGHTS", ""),
      "failure-fridays": required("DISCORD_CHANNEL_FAILURE_FRIDAYS"),
      "commons-projects": optional("DISCORD_CHANNEL_COMMONS_PROJECTS", ""),
      // resources
      materials: optional("DISCORD_CHANNEL_MATERIALS", ""),
      "job-board": optional("DISCORD_CHANNEL_JOB_BOARD", ""),
      "tech-events": optional("DISCORD_CHANNEL_TECH_EVENTS", ""),
      hangouts: optional("DISCORD_CHANNEL_HANGOUTS", ""),
    },
    ownerId: required("DISCORD_OWNER_ID"),
  },
  timezone: optional("TIMEZONE", "Africa/Lagos"),
};
