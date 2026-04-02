// ═══════════════════════════════════════════════════
// AI Content Generator — Groq Compound Engine
// ═══════════════════════════════════════════════════
//
// Uses Groq's Compound system (groq/compound) for:
//   1. Researching trending topics via built-in web search
//   2. Generating platform-specific content in David's voice
//   3. Writing blog drafts for Medium/Substack/Hashnode
//
// Groq Compound handles research + writing in a single API call.
// No need for a separate search API.

import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { Platform } from "../types/index.js";

// ─── Initialize Groq client ───
const groq = new Groq({
  apiKey: config.groq.apiKey,
});

// ═══════════════════════════════════════════════════
// David's writing voice — the system prompt
// ═══════════════════════════════════════════════════

// const DAVID_VOICE = `You are writing as David Orisabiyi — a full-stack engineer and community builder based in Lagos, Nigeria. You are the founder of Common Chronicles, a community for builders, creatives, and storytellers in tech.

// Your writing voice:
// - Conversational and direct. You write like you talk to a friend who's also in tech.
// - Short paragraphs. Lots of line breaks. You let ideas breathe.
// - You don't use corporate speak, buzzwords, or "thought leader" language.
// - You're honest about what's hard — you talk about failures, doubt, and the messy middle of building things.
// - You occasionally reference Lagos, the Nigerian tech scene, and building from Africa.
// - You don't use hashtags unless specifically asked. You don't use emojis excessively — maybe 1-2 per post max.
// - You never sound like AI. No "in today's fast-paced world" or "let's dive in" or "here's the thing" as openers.
// - You reference real tools you use: Next.js, TypeScript, Prisma, Tailwind, Vercel, Neon, Claude, Gemini.
// - Your tone is warm but not soft. You have opinions and you say them plainly.

// Things you NEVER do:
// - Use "🚀" emoji
// - Start with "Hey everyone!" or "Happy [day]!"
// - Write bullet-point listicles unless specifically asked
// - Use phrases like "game-changer", "unlock", "level up", "deep dive", "leverage"
// - Sound motivational or preachy
// - Write in a way that could be mistaken for AI-generated content

// Your community Common Chronicles has two core programs:
// - Story Circles: Monthly — one person shares the unfiltered story behind what they're building
// - Failure Fridays: Biweekly — someone shares what went wrong and what they learned

// You write about: building products, community building, the reality of being a developer in Lagos, AI tools, React/Next.js ecosystem, and the human side of tech.`;

const DAVID_VOICE = `You write as David Orisabiyi — full-stack dev and community builder in Lagos, Nigeria. Founder of Common Chronicles, a community for builders and storytellers in tech.

Your voice: conversational, direct, short paragraphs. You talk about failures and the messy middle of building. You reference Lagos and building from Africa. No corporate speak, no buzzwords.

NEVER: use 🚀, start with "Hey everyone!", write listicles, say "game-changer"/"unlock"/"level up"/"deep dive", or sound like AI. No "in today's fast-paced world" or "let's dive in."

You use: Next.js, TypeScript, Prisma, Tailwind, Vercel, Neon, Claude, Gemini.

Community programs: Story Circles (monthly, unfiltered founder stories) and Failure Fridays (biweekly, sharing what went wrong).`;

// ═══════════════════════════════════════════════════
// Platform-specific constraints
// ═══════════════════════════════════════════════════

const PLATFORM_CONSTRAINTS: Record<string, string> = {
  twitter: `Write a tweet or short thread (max 280 chars per tweet, max 5 tweets for a thread).
Keep it punchy. Each tweet should stand alone but connect to the next.
No hashtags. No "thread 🧵" opener. Just start talking.
If it's a thread, number them 1/, 2/, etc.`,

  instagram: `Write an Instagram caption. 
Max 2200 characters but keep it under 1000 for readability.
Include a call to action at the end (follow, link in bio, join Discord, etc).
Write for people scrolling — the first line needs to stop them.
Include a note about what the visual should be.`,

  discord: `Write a Discord community post.
Conversational, like you're talking to friends in a group chat.
End with a question or prompt that invites people to respond.
Use Discord markdown (bold with **, etc).
Keep it under 1500 characters.`,

  linkedin: `Write a LinkedIn post.
Professional but human. Not corporate.
Long-form is fine — LinkedIn rewards longer posts.
Start with a hook that makes people click "see more".
No hashtags at the end.`,

  medium: `Write a full blog post for Medium.
Include a compelling title, introduction, main sections with subheadings, and a conclusion.
Target 800-1500 words.
Include code examples if the topic is technical.
Write in first person. Make it feel like a conversation, not a lecture.`,

  substack: `Write a newsletter-style post for Substack.
More personal and intimate than Medium — like you're writing to subscribers who know you.
Can be shorter (500-1000 words).
Include a personal anecdote or reflection that ties into the main topic.`,

  hashnode: `Write a technical blog post for Hashnode.
More technical than Medium — the audience is developers.
Include code snippets, architecture decisions, and practical takeaways.
Target 1000-2000 words.
Be opinionated about tools and approaches.`,
};

// ═══════════════════════════════════════════════════
// Generate content for a specific platform
// ═══════════════════════════════════════════════════

export interface GeneratedContent {
  title: string;
  content: string;
  platform: Platform;
  topic: string;
  researchSummary?: string;
  suggestedTags?: string[];
}

export async function generateContent(
  topic: string,
  platform: Platform,
  additionalContext?: string
): Promise<GeneratedContent> {
  logger.info(`Generating ${platform} content for: "${topic}"`);

  const platformGuide =
    PLATFORM_CONSTRAINTS[platform] || PLATFORM_CONSTRAINTS.twitter;

  const prompt = `Research the following topic and write a ${platform} post about it:

TOPIC: ${topic}

${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ""}

PLATFORM REQUIREMENTS:
${platformGuide}

Research the topic using web search to find recent, accurate information. Then write the post in David's voice.

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "title": "A short title for this content piece",
  "content": "The full post content ready to publish",
  "researchSummary": "2-3 sentence summary of what you found during research",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        { role: "system", content: DAVID_VOICE },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_completion_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content || "";

    // Parse the JSON response
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    logger.info(`Generated content: "${parsed.title}"`);

    return {
      title: parsed.title,
      content: parsed.content,
      platform,
      topic,
      researchSummary: parsed.researchSummary,
      suggestedTags: parsed.suggestedTags,
    };
  } catch (error: any) {
    logger.error("Content generation failed", { error: error.message, topic });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Generate weekly content ideas
// ═══════════════════════════════════════════════════

export interface ContentIdea {
  topic: string;
  angle: string;
  platforms: Platform[];
  urgency: "trending" | "evergreen" | "timely";
}

export async function generateWeeklyIdeas(
  count: number = 7
): Promise<ContentIdea[]> {
  logger.info(`Generating ${count} weekly content ideas...`);

  const prompt = `Research current trends in the tech world right now and suggest ${count} content ideas for David — a full-stack developer and community builder in Lagos, Nigeria.

His audience: mid-to-senior engineers, builders, and people interested in the human side of tech.

His interests: Next.js, TypeScript, AI tools (Claude, Gemini), building in public, community building, the Lagos/African tech scene, React ecosystem, developer experience.

For each idea, suggest which platforms it would work best on (twitter, instagram, discord, linkedin, medium, substack, hashnode).

Research what's actually trending in tech right now using web search. Don't make up trends.

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "ideas": [
    {
      "topic": "The specific topic",
      "angle": "The unique angle or take David could bring to it",
      "platforms": ["twitter", "medium"],
      "urgency": "trending"
    }
  ]
}

Urgency values:
- "trending": happening right now, post within 1-2 days
- "timely": relevant this week/month
- "evergreen": always relevant, can schedule anytime`;

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        { role: "system", content: DAVID_VOICE },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_completion_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    logger.info(`Generated ${parsed.ideas.length} content ideas`);
    return parsed.ideas;
  } catch (error: any) {
    logger.error("Idea generation failed", { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Generate a full blog post with research
// ═══════════════════════════════════════════════════

export async function generateBlogPost(
  topic: string,
  targetPlatform: "medium" | "substack" | "hashnode" = "medium"
): Promise<GeneratedContent> {
  logger.info(`Generating ${targetPlatform} blog post: "${topic}"`);

  const platformGuide = PLATFORM_CONSTRAINTS[targetPlatform];

  const prompt = `Research this topic thoroughly and write a complete blog post:

TOPIC: ${topic}

PLATFORM: ${targetPlatform}
${platformGuide}

This needs to be a well-researched, complete article. Use web search to:
1. Find the latest information and developments on this topic
2. Get specific examples, numbers, or case studies
3. Verify any technical claims

Then write the full article in David's voice. Be specific. Use real examples. Include code if relevant.

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "title": "The article title",
  "content": "The full article in markdown format",
  "researchSummary": "Key facts and sources found during research",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/mini",
      messages: [
        { role: "system", content: DAVID_VOICE },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title,
      content: parsed.content,
      platform: targetPlatform,
      topic,
      researchSummary: parsed.researchSummary,
      suggestedTags: parsed.suggestedTags,
    };
  } catch (error: any) {
    logger.error("Blog generation failed", { error: error.message, topic });
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// Repurpose content across platforms
// ═══════════════════════════════════════════════════

export async function repurposeContent(
  originalContent: string,
  originalPlatform: Platform,
  targetPlatform: Platform
): Promise<GeneratedContent> {
  logger.info(`Repurposing ${originalPlatform} → ${targetPlatform}`);

  const platformGuide =
    PLATFORM_CONSTRAINTS[targetPlatform] || PLATFORM_CONSTRAINTS.twitter;

  const prompt = `Take this ${originalPlatform} post and repurpose it for ${targetPlatform}.

ORIGINAL CONTENT:
${originalContent}

TARGET PLATFORM REQUIREMENTS:
${platformGuide}

Don't just copy-paste and shorten. Rethink the idea for the new platform. Same core message, different execution.

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "title": "Title for the repurposed piece",
  "content": "The repurposed content",
  "suggestedTags": ["tag1", "tag2"]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        { role: "system", content: DAVID_VOICE },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_completion_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title,
      content: parsed.content,
      platform: targetPlatform,
      topic: `Repurposed from ${originalPlatform}`,
      suggestedTags: parsed.suggestedTags,
    };
  } catch (error: any) {
    logger.error("Repurpose failed", { error: error.message });
    throw error;
  }
}
