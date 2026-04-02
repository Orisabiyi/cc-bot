// ═══════════════════════════════════════════════════
// Content Pipeline — AI → Notion Integration
// ═══════════════════════════════════════════════════
//
// Connects the AI content generator to the Notion
// Content Pipeline database. Handles:
//   1. Generating content ideas and saving to Notion as drafts
//   2. Generating content for a topic and saving to Notion
//   3. Weekly batch generation of content ideas
//   4. Repurposing existing content across platforms

import { Client } from "@notionhq/client";
import dayjs from "dayjs";
import {
  generateContent,
  generateWeeklyIdeas,
  generateBlogPost,
  repurposeContent,
  type GeneratedContent,
  type ContentIdea,
} from "./content-generator";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { Platform } from "../types/index.js";

const notion = new Client({ auth: config.notion.apiKey });
const DATABASE_ID = config.notion.contentCalendarPageId;

// ─── Platform → Notion select value mapping ───
const PLATFORM_NOTION: Record<Platform, string> = {
  discord: "Discord",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  medium: "Medium",
  substack: "Substack",
  hashnode: "Hashnode",
};

// ═══════════════════════════════════════════════════
// Generate content and save directly to Notion
// ═══════════════════════════════════════════════════

export async function generateAndSave(
  topic: string,
  platform: Platform,
  scheduledDate?: string,
  additionalContext?: string
): Promise<{ notionPageId: string; content: GeneratedContent }> {
  logger.info(`Generating and saving ${platform} content: "${topic}"`);

  // Generate the content via Groq
  const generated = await generateContent(topic, platform, additionalContext);

  // Determine the scheduled date (default: tomorrow)
  const date = scheduledDate || dayjs().add(1, "day").format("YYYY-MM-DD");

  // Determine the week number
  const dayOfMonth = dayjs(date).date();
  const week =
    dayOfMonth <= 7
      ? "Week 1"
      : dayOfMonth <= 14
        ? "Week 2"
        : dayOfMonth <= 21
          ? "Week 3"
          : "Week 4";

  // Save to Notion as a Draft
  const properties: any = {
    Title: {
      title: [{ type: "text", text: { content: generated.title } }],
    },
    Platform: { select: { name: PLATFORM_NOTION[platform] } },
    Status: { select: { name: "Draft" } },
    "Scheduled Date": { date: { start: date } },
    Content: {
      rich_text: [
        {
          type: "text",
          text: { content: truncate(generated.content, 2000) },
        },
      ],
    },
    Week: { select: { name: week } },
  };

  // Add research summary and tags to notes
  if (generated.researchSummary) {
    properties.Notes = {
      rich_text: [
        {
          type: "text",
          text: {
            content: `AI-generated | Research: ${generated.researchSummary}`,
          },
        },
      ],
    };
  }

  // Add tags if available
  if (generated.suggestedTags && generated.suggestedTags.length > 0) {
    // Map to existing tag options, skip unknown ones
    const validTags = [
      "origin-story",
      "programs",
      "story-circle",
      "failure-friday",
      "commons",
      "community",
      "event",
      "recap",
      "milestone",
    ];
    const matchedTags = generated.suggestedTags
      .map((t) => t.toLowerCase().replace(/\s+/g, "-"))
      .filter((t) => validTags.includes(t))
      .map((name) => ({ name }));

    if (matchedTags.length > 0) {
      properties.Tags = { multi_select: matchedTags };
    }
  }

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });

  logger.info(`Saved draft to Notion: ${generated.title} (${page.id})`);

  return {
    notionPageId: page.id,
    content: generated,
  };
}

// ═══════════════════════════════════════════════════
// Generate a blog post and save to Notion
// ═══════════════════════════════════════════════════

export async function generateBlogAndSave(
  topic: string,
  targetPlatform: "medium" | "substack" | "hashnode" = "medium",
  scheduledDate?: string
): Promise<{ notionPageId: string; content: GeneratedContent }> {
  logger.info(`Generating ${targetPlatform} blog: "${topic}"`);

  const generated = await generateBlogPost(topic, targetPlatform);
  const date = scheduledDate || dayjs().add(3, "day").format("YYYY-MM-DD");

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Title: {
        title: [{ type: "text", text: { content: generated.title } }],
      },
      Platform: {
        select: { name: PLATFORM_NOTION[targetPlatform] },
      },
      Status: { select: { name: "Draft" } },
      "Scheduled Date": { date: { start: date } },
      Content: {
        rich_text: [
          {
            type: "text",
            text: { content: truncate(generated.content, 2000) },
          },
        ],
      },
      "Content Type": { select: { name: "Thread" } },
      Notes: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `AI-generated blog | Full content may be truncated — edit in Notion. Research: ${generated.researchSummary || "N/A"}`,
            },
          },
        ],
      },
    },
  });

  logger.info(`Saved blog draft: ${generated.title} (${page.id})`);

  return { notionPageId: page.id, content: generated };
}

// ═══════════════════════════════════════════════════
// Generate weekly ideas and save as drafts
// ═══════════════════════════════════════════════════

export async function generateWeeklyPlan(
  startDate?: string
): Promise<{ ideas: ContentIdea[]; savedCount: number }> {
  logger.info("Generating weekly content plan...");

  const ideas = await generateWeeklyIdeas(7);
  let savedCount = 0;

  const start = startDate
    ? dayjs(startDate)
    : dayjs().add(1, "day");

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const date = start.add(i, "day").format("YYYY-MM-DD");

    // Pick the first platform from suggestions
    const platform = idea.platforms[0] || "twitter";

    try {
      // Generate actual content for each idea
      const generated = await generateContent(
        idea.topic,
        platform as Platform,
        idea.angle
      );

      await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          Title: {
            title: [
              { type: "text", text: { content: generated.title } },
            ],
          },
          Platform: {
            select: { name: PLATFORM_NOTION[platform as Platform] || "Twitter/X" },
          },
          Status: { select: { name: "Draft" } },
          "Scheduled Date": { date: { start: date } },
          Content: {
            rich_text: [
              {
                type: "text",
                text: { content: truncate(generated.content, 2000) },
              },
            ],
          },
          Notes: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `AI-generated | Urgency: ${idea.urgency} | Angle: ${idea.angle}`,
                },
              },
            ],
          },
        },
      });

      savedCount++;
      logger.info(`Saved idea ${i + 1}/${ideas.length}: ${generated.title}`);

      // Small delay to avoid rate limiting
      await sleep(1000);
    } catch (error: any) {
      logger.error(`Failed to save idea ${i + 1}`, {
        error: error.message,
        topic: idea.topic,
      });
    }
  }

  logger.info(
    `Weekly plan complete: ${savedCount}/${ideas.length} ideas saved to Notion`
  );

  return { ideas, savedCount };
}

// ═══════════════════════════════════════════════════
// Repurpose an existing Notion entry to another platform
// ═══════════════════════════════════════════════════

export async function repurposeAndSave(
  sourcePageId: string,
  targetPlatform: Platform,
  scheduledDate?: string
): Promise<{ notionPageId: string; content: GeneratedContent }> {
  logger.info(`Repurposing ${sourcePageId} → ${targetPlatform}`);

  // Fetch the source page content from Notion
  const sourcePage = await notion.pages.retrieve({ page_id: sourcePageId });
  const props = (sourcePage as any).properties;

  const sourceContent =
    props["Content"]?.rich_text?.map((rt: any) => rt.plain_text).join("") || "";
  const sourcePlatformName = props["Platform"]?.select?.name || "Twitter/X";

  // Map back to our Platform type
  const sourcePlatformMap: Record<string, Platform> = {
    Discord: "discord",
    "Twitter/X": "twitter",
    LinkedIn: "linkedin",
    Instagram: "instagram",
    Medium: "medium",
    Substack: "substack",
    Hashnode: "hashnode",
  };
  const sourcePlatform = sourcePlatformMap[sourcePlatformName] || "twitter";

  // Generate repurposed content
  const repurposed = await repurposeContent(
    sourceContent,
    sourcePlatform,
    targetPlatform
  );

  const date = scheduledDate || dayjs().add(1, "day").format("YYYY-MM-DD");

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Title: {
        title: [
          { type: "text", text: { content: repurposed.title } },
        ],
      },
      Platform: {
        select: { name: PLATFORM_NOTION[targetPlatform] },
      },
      Status: { select: { name: "Draft" } },
      "Scheduled Date": { date: { start: date } },
      Content: {
        rich_text: [
          {
            type: "text",
            text: { content: truncate(repurposed.content, 2000) },
          },
        ],
      },
      Notes: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `Repurposed from ${sourcePlatformName} (${sourcePageId})`,
            },
          },
        ],
      },
    },
  });

  logger.info(`Saved repurposed content: ${repurposed.title}`);
  return { notionPageId: page.id, content: repurposed };
}

// Helpers
function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 3) + "..." : str;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
