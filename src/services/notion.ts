// ═══════════════════════════════════════════════════
// Notion Service — Reads from the Content Pipeline DB
// ═══════════════════════════════════════════════════
//
// Queries the "Content Pipeline" Notion database (structured
// with proper properties) instead of parsing raw page content.
//
// Database schema:
//   Title, Platform, Status, Scheduled Date, Discord Channel,
//   Content, Content Type, Week, Tags, Posted At, Post URL, Notes
//
// Bot workflow:
//   1. Query items where Status = "Ready" or "Scheduled"
//   2. Filter by today's date
//   3. Post Discord items → auto-post
//   4. Other platforms → DM reminder
//   5. After posting → update Status to "Posted" + set Posted At

import { Client } from "@notionhq/client";
import dayjs from "dayjs";
import type {
  ContentItem,
  Platform,
  DiscordChannelType,
} from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

// ─── Initialize Notion client ───
const notion = new Client({ auth: config.notion.apiKey });

// ─── Your Content Pipeline database ID ───
const DATABASE_ID = config.notion.contentCalendarPageId;

// ─── Platform name mapping (Notion select → our types) ───
const PLATFORM_MAP: Record<string, Platform> = {
  Discord: "discord",
  "Twitter/X": "twitter",
  LinkedIn: "linkedin",
  Instagram: "instagram",
  WhatsApp: "whatsapp",
  Medium: "medium",
  Substack: "substack",
  Hashnode: "hashnode",
};

// ─── Discord channel mapping (Notion select value → channel type) ───
const CHANNEL_MAP: Record<string, DiscordChannelType> = {
  // info
  rules: "rules",
  "moderator-only": "moderator-only",
  // Start Here
  welcome: "welcome",
  introductions: "introductions",
  "pick-your-role": "pick-your-role",
  // community
  general: "general",
  showcase: "showcase",
  "off-topic": "off-topic",
  // updates
  announcements: "announcements",
  "podcast-blog": "podcast-blog",
  // programs
  "story-circles": "story-circles",
  "global-spotlights": "global-spotlights",
  "failure-fridays": "failure-fridays",
  "commons-projects": "commons-projects",
  // resources
  materials: "materials",
  "job-board": "job-board",
  "tech-events": "tech-events",
  hangouts: "hangouts",
  // Backward compat with old DB values
  "story-circle": "story-circles",
  "failure-friday": "failure-fridays",
  "show-your-work": "showcase",
};

// ═══════════════════════════════════════════════════
// Query all actionable content from the database
// ═══════════════════════════════════════════════════

export async function fetchContentCalendar(): Promise<ContentItem[]> {
  logger.info("Querying Content Pipeline database...");

  try {
    const items: ContentItem[] = [];
    let cursor: string | undefined;

    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          or: [
            { property: "Status", select: { equals: "Ready" } },
            { property: "Status", select: { equals: "Scheduled" } },
          ],
        },
        sorts: [
          { property: "Scheduled Date", direction: "ascending" },
        ],
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const item = parsePageToContentItem(page);
        if (item) items.push(item);
      }

      cursor = response.has_more
        ? (response.next_cursor ?? undefined)
        : undefined;
    } while (cursor);

    logger.info(`Found ${items.length} actionable content items`);
    return items;
  } catch (error: any) {
    logger.error("Failed to query Content Pipeline", { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Parse a Notion page into our ContentItem type
// ═══════════════════════════════════════════════════

function parsePageToContentItem(page: any): ContentItem | null {
  try {
    const props = page.properties;

    const title = props["Title"]?.title?.[0]?.plain_text || "Untitled";

    const platformValue = props["Platform"]?.select?.name;
    const platform = platformValue ? PLATFORM_MAP[platformValue] : null;
    if (!platform) {
      logger.warn(`Skipping "${title}" — no valid platform`);
      return null;
    }

    const dateStart = props["Scheduled Date"]?.date?.start;
    if (!dateStart) {
      logger.warn(`Skipping "${title}" — no scheduled date`);
      return null;
    }

    const content =
      props["Content"]?.rich_text
        ?.map((rt: any) => rt.plain_text)
        .join("") || "";

    if (!content.trim()) {
      logger.warn(`Skipping "${title}" — empty content`);
      return null;
    }

    const status = props["Status"]?.select?.name?.toLowerCase() || "draft";

    const discordChannelValue = props["Discord Channel"]?.select?.name;
    const discordChannel = discordChannelValue
      ? CHANNEL_MAP[discordChannelValue]
      : "general";

    const contentType = props["Content Type"]?.select?.name || "";

    const tags =
      props["Tags"]?.multi_select?.map((tag: any) => tag.name) || [];

    return {
      id: page.id,
      title,
      platform,
      scheduledDate: dateStart,
      content,
      status: status as ContentItem["status"],
      discordChannel: platform === "discord" ? discordChannel : undefined,
      notionPageId: page.id,
      tags: [...tags, contentType].filter(Boolean),
    };
  } catch (error: any) {
    logger.error("Failed to parse page", { error: error.message, pageId: page.id });
    return null;
  }
}

// ═══════════════════════════════════════════════════
// Get today's scheduled content
// ═══════════════════════════════════════════════════

export async function getTodaysContent(): Promise<ContentItem[]> {
  const today = dayjs().format("YYYY-MM-DD");
  logger.info(`Fetching content for ${today}`);

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            or: [
              { property: "Status", select: { equals: "Ready" } },
              { property: "Status", select: { equals: "Scheduled" } },
            ],
          },
          {
            property: "Scheduled Date",
            date: { equals: today },
          },
        ],
      },
    });

    const items = response.results
      .map(parsePageToContentItem)
      .filter((item): item is ContentItem => item !== null);

    logger.info(`Found ${items.length} items for today`);
    return items;
  } catch (error: any) {
    logger.error("Failed to fetch today's content", { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Get content for a date range
// ═══════════════════════════════════════════════════

export async function getContentForDateRange(
  startDate: string,
  endDate: string
): Promise<ContentItem[]> {
  logger.info(`Fetching content from ${startDate} to ${endDate}`);

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            or: [
              { property: "Status", select: { equals: "Ready" } },
              { property: "Status", select: { equals: "Scheduled" } },
              { property: "Status", select: { equals: "Draft" } },
            ],
          },
          { property: "Scheduled Date", date: { on_or_after: startDate } },
          { property: "Scheduled Date", date: { on_or_before: endDate } },
        ],
      },
      sorts: [{ property: "Scheduled Date", direction: "ascending" }],
    });

    return response.results
      .map(parsePageToContentItem)
      .filter((item): item is ContentItem => item !== null);
  } catch (error: any) {
    logger.error("Failed to fetch date range", { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Get upcoming events (Story Circles, Failure Fridays)
// ═══════════════════════════════════════════════════

export async function getUpcomingEvents(
  daysAhead: number = 7
): Promise<ContentItem[]> {
  const today = dayjs().format("YYYY-MM-DD");
  const endDate = dayjs().add(daysAhead, "day").format("YYYY-MM-DD");

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            or: [
              { property: "Content Type", select: { equals: "Story Circle" } },
              { property: "Content Type", select: { equals: "Failure Friday" } },
            ],
          },
          { property: "Scheduled Date", date: { on_or_after: today } },
          { property: "Scheduled Date", date: { on_or_before: endDate } },
        ],
      },
      sorts: [{ property: "Scheduled Date", direction: "ascending" }],
    });

    return response.results
      .map(parsePageToContentItem)
      .filter((item): item is ContentItem => item !== null);
  } catch (error: any) {
    logger.error("Failed to fetch upcoming events", { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Mark a content item as "Posted"
// ═══════════════════════════════════════════════════

export async function markAsPosted(
  pageId: string,
  postUrl?: string
): Promise<void> {
  try {
    const updateProps: any = {
      Status: { select: { name: "Posted" } },
      "Posted At": { date: { start: new Date().toISOString() } },
    };

    if (postUrl) {
      updateProps["Post URL"] = { url: postUrl };
    }

    await notion.pages.update({
      page_id: pageId,
      properties: updateProps,
    });

    logger.info(`Marked ${pageId} as Posted`);
  } catch (error: any) {
    logger.error("Failed to mark as posted", { error: error.message, pageId });
  }
}

// ═══════════════════════════════════════════════════
// Mark a content item as "Failed"
// ═══════════════════════════════════════════════════

export async function markAsFailed(
  pageId: string,
  errorMessage: string
): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Status: { select: { name: "Failed" } },
        Notes: {
          rich_text: [
            { type: "text", text: { content: `Bot error: ${errorMessage}` } },
          ],
        },
      },
    });

    logger.warn(`Marked ${pageId} as Failed: ${errorMessage}`);
  } catch (error: any) {
    logger.error("Failed to mark as failed", { error: error.message, pageId });
  }
}
