// ═══════════════════════════════════════════════════
// Common Chronicles Content Bot — Type Definitions
// ═══════════════════════════════════════════════════

export type Platform =
  | "discord"
  | "twitter"
  | "linkedin"
  | "instagram"
  | "whatsapp"
  | "medium"
  | "substack"
  | "hashnode";

export type ContentStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "posted"
  | "failed";

export type DiscordChannelType =
  // info
  | "rules"
  | "moderator-only"
  // Start Here
  | "welcome"
  | "introductions"
  | "pick-your-role"
  // community
  | "general"
  | "showcase"
  | "off-topic"
  // updates
  | "announcements"
  | "podcast-blog"
  // programs
  | "story-circles"
  | "global-spotlights"
  | "failure-fridays"
  | "commons-projects"
  // resources
  | "materials"
  | "job-board"
  | "tech-events"
  | "hangouts";

export interface ContentItem {
  id: string;
  title: string;
  platform: Platform;
  scheduledDate: string; // ISO date string
  scheduledTime?: string; // e.g. "10:00"
  content: string;
  status: ContentStatus;
  discordChannel?: DiscordChannelType;
  notionPageId: string;
  tags?: string[];
}

export interface ParsedCalendarEntry {
  date: string; // e.g. "2026-03-03"
  dayOfWeek: string; // e.g. "Monday"
  platform: Platform;
  content: string;
  isEvent?: boolean; // e.g. Story Circle, Failure Friday
  eventName?: string;
}

export interface PostResult {
  success: boolean;
  platform: Platform;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface ReminderPayload {
  platform: Platform;
  content: string;
  scheduledDate: string;
  action: "post" | "review" | "event";
  eventName?: string;
}

export interface BotConfig {
  notion: {
    apiKey: string;
    contentCalendarPageId: string;
  };
  discord: {
    botToken: string;
    guildId: string;
    channels: Record<DiscordChannelType, string>;
    ownerId: string;
  };
  timezone: string;
}
