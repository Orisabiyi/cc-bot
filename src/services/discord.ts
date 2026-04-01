// ═══════════════════════════════════════════════════
// Discord Service — Posts content & sends reminders
// ═══════════════════════════════════════════════════
//
// Handles:
// 1. Auto-posting to Discord channels (announcements, events, etc.)
// 2. Sending you DM reminders for non-Discord platforms
// 3. Event announcements (Story Circle, Failure Friday)

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  type Message,
} from "discord.js";
import type {
  ContentItem,
  DiscordChannelType,
  ReminderPayload,
  PostResult,
  Platform,
} from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

// ─── Discord client singleton ───
let client: Client | null = null;

// ═══════════════════════════════════════════════════
// Initialize & connect the Discord bot
// ═══════════════════════════════════════════════════

export async function initDiscord(): Promise<Client> {
  if (client?.isReady()) return client;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ],
  });

  return new Promise((resolve, reject) => {
    client!.once("ready", () => {
      logger.info(`Discord bot logged in as ${client!.user?.tag}`);
      resolve(client!);
    });

    client!.once("error", (err) => {
      logger.error("Discord client error", { error: err.message });
      reject(err);
    });

    client!.login(config.discord.botToken);
  });
}

// ═══════════════════════════════════════════════════
// Post content to a Discord channel
// ═══════════════════════════════════════════════════

export async function postToDiscord(item: ContentItem): Promise<PostResult> {
  try {
    const bot = await initDiscord();
    const channelId =
      config.discord.channels[item.discordChannel || "general"];

    if (!channelId) {
      throw new Error(`No channel ID configured for: ${item.discordChannel}`);
    }

    const channel = await bot.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or not a text channel`);
    }

    // Build the message — use embeds for events, plain text for general posts
    let message: Message;

    if (item.tags?.some((t) => t.includes("Story Circle") || t.includes("Failure Friday"))) {
      // ─── Event announcement with embed ───
      const embed = buildEventEmbed(item);
      message = await channel.send({ embeds: [embed] });
    } else {
      // ─── Regular community post ───
      const formatted = formatForDiscord(item.content);
      message = await channel.send(formatted);
    }

    logger.info(`Posted to Discord #${item.discordChannel}`, {
      messageId: message.id,
      title: item.title,
    });

    return {
      success: true,
      platform: "discord",
      messageId: message.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error("Failed to post to Discord", {
      error: error.message,
      item: item.title,
    });

    return {
      success: false,
      platform: "discord",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════
// Send DM reminder to you (for non-Discord platforms)
// ═══════════════════════════════════════════════════

export async function sendReminder(
  reminder: ReminderPayload
): Promise<PostResult> {
  try {
    const bot = await initDiscord();
    const owner = await bot.users.fetch(config.discord.ownerId);

    const platformEmoji = getPlatformEmoji(reminder.platform);
    const actionLabel =
      reminder.action === "post"
        ? "📝 Time to post"
        : reminder.action === "event"
        ? "🎙️ Event today"
        : "👀 Review draft";

    const embed = new EmbedBuilder()
      .setColor(0xe8b84b) // Common Chronicles gold
      .setTitle(`${actionLabel} — ${platformEmoji} ${capitalize(reminder.platform)}`)
      .setDescription(truncate(reminder.content, 2000))
      .addFields(
        { name: "Scheduled", value: reminder.scheduledDate, inline: true },
        { name: "Platform", value: capitalize(reminder.platform), inline: true }
      )
      .setFooter({ text: "Common Chronicles Content Bot" })
      .setTimestamp();

    if (reminder.eventName) {
      embed.addFields({
        name: "Event",
        value: reminder.eventName,
        inline: true,
      });
    }

    const dm = await owner.send({ embeds: [embed] });

    logger.info(`Sent DM reminder for ${reminder.platform}`, {
      messageId: dm.id,
    });

    return {
      success: true,
      platform: reminder.platform,
      messageId: dm.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error("Failed to send DM reminder", {
      error: error.message,
      platform: reminder.platform,
    });

    return {
      success: false,
      platform: reminder.platform,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════
// Build a rich embed for event announcements
// ═══════════════════════════════════════════════════

function buildEventEmbed(item: ContentItem): EmbedBuilder {
  const isStoryCircle = item.tags?.some((t) => t.includes("Story Circle"));
  const color = isStoryCircle ? 0x7baf7b : 0xe8b84b; // sage for story, gold for failure

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(item.title)
    .setDescription(item.content)
    .setFooter({ text: "Common Chronicles" })
    .setTimestamp();

  if (isStoryCircle) {
    embed.setThumbnail(
      "https://commonchronicles.live/story-circle-icon.png"
    ); // Replace with actual URL
  }

  return embed;
}

// ═══════════════════════════════════════════════════
// Format content for Discord (markdown cleanup)
// ═══════════════════════════════════════════════════

function formatForDiscord(content: string): string {
  // Discord supports most markdown, but let's clean up Notion-specific stuff
  let formatted = content
    .replace(/<br\s*\/?>/gi, "\n") // <br> → newline
    .replace(/\\n/g, "\n") // literal \n
    .replace(/\[Luma link\]/gi, "[RSVP Link]") // placeholder links
    .trim();

  // Truncate if too long for Discord (2000 char limit)
  if (formatted.length > 1950) {
    formatted = formatted.substring(0, 1947) + "...";
  }

  return formatted;
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function getPlatformEmoji(platform: Platform): string {
  const map: Record<Platform, string> = {
    discord: "💬",
    twitter: "🐦",
    linkedin: "💼",
    instagram: "📸",
    whatsapp: "📱",
    medium: "📝",
    substack: "📨",
    hashnode: "🔗",
  };
  return map[platform] || "📌";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 3) + "..." : str;
}

// ═══════════════════════════════════════════════════
// Graceful shutdown
// ═══════════════════════════════════════════════════

export async function disconnectDiscord(): Promise<void> {
  if (client) {
    client.destroy();
    client = null;
    logger.info("Discord client disconnected");
  }
}
