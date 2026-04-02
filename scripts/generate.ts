// ═══════════════════════════════════════════════════
// Generate content from CLI
// ═══════════════════════════════════════════════════
//
// Usage:
//   pnpm run generate -- --topic "AI agents" --platform twitter
//   pnpm run generate -- --topic "Next.js 15 RSC" --platform medium
//   pnpm run generate -- --topic "building in Lagos" --platform instagram --date 2026-04-10
//   pnpm run generate -- --weekly                    # generate a full week of ideas
//   pnpm run generate -- --blog "Prisma vs Drizzle" --for hashnode

import {
  generateAndSave,
  generateBlogAndSave,
  generateWeeklyPlan,
} from "../src/services/content-pipeline";
import { logger } from "../src/utils/logger.js";
import type { Platform } from "../src/types/index.js";
import { config } from "../src/config/index.js";

async function main() {
  const args = process.argv.slice(2);

  // Parse CLI arguments
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const hasFlag = (flag: string): boolean => args.includes(flag);

  // ─── Weekly plan mode ───
  if (hasFlag("--weekly")) {
    const startDate = getArg("--from");
    console.log("\n🧠 Generating weekly content plan...\n");

    const result = await generateWeeklyPlan(startDate);

    console.log(`\n✅ Generated ${result.savedCount} content drafts in Notion!\n`);
    console.log("Ideas generated:");
    for (const idea of result.ideas) {
      const emoji =
        idea.urgency === "trending"
          ? "🔥"
          : idea.urgency === "timely"
            ? "⏰"
            : "🌿";
      console.log(
        `  ${emoji} ${idea.topic} → ${idea.platforms.join(", ")}`
      );
    }
    console.log(
      "\nAll drafts saved to your Content Pipeline. Review and flip to 'Ready' when approved."
    );
    return;
  }

  // ─── Blog post mode ───
  const blogTopic = getArg("--blog");
  if (blogTopic) {
    const platform = (getArg("--for") || "medium") as
      | "medium"
      | "substack"
      | "hashnode";
    const date = getArg("--date");

    console.log(`\n📝 Generating ${platform} blog post: "${blogTopic}"...\n`);

    const result = await generateBlogAndSave(blogTopic, platform, date);

    console.log(`\n✅ Blog draft saved to Notion!`);
    console.log(`   Title: ${result.content.title}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Research: ${result.content.researchSummary}`);
    console.log(
      `\n   Open Notion to review and edit the draft before publishing.`
    );
    return;
  }

  // ─── Single content mode ───
  const topic = getArg("--topic");
  const platform = (getArg("--platform") || "twitter") as Platform;
  const date = getArg("--date");

  if (!topic) {
    console.log(`
CC Content Bot — AI Content Generator

Usage:
  pnpm run generate -- --topic "your topic" --platform twitter
  pnpm run generate -- --topic "your topic" --platform instagram --date 2026-04-15
  pnpm run generate -- --blog "your topic" --for medium
  pnpm run generate -- --blog "your topic" --for hashnode
  pnpm run generate -- --weekly
  pnpm run generate -- --weekly --from 2026-04-14

Platforms: twitter, instagram, discord, linkedin, medium, substack, hashnode
    `);
    return;
  }

  console.log(
    `\n🧠 Generating ${platform} content: "${topic}"...\n`
  );

  const result = await generateAndSave(topic, platform, date);

  console.log(`\n✅ Draft saved to Notion!`);
  console.log(`   Title: ${result.content.title}`);
  console.log(`   Platform: ${platform}`);
  if (result.content.researchSummary) {
    console.log(`   Research: ${result.content.researchSummary}`);
  }
  console.log(`\n   Preview:`);
  console.log(
    `   ${result.content.content.substring(0, 200)}...`
  );
  console.log(
    `\n   Open Notion to review and flip to 'Ready' when approved.`
  );
}

main().catch((err) => {
  logger.error("Generate failed", { error: err.message });
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
