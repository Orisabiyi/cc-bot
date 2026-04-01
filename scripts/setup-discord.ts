// ═══════════════════════════════════════════════════
// Discord Setup Helper
// Usage: npm run setup:discord
// ═══════════════════════════════════════════════════
// Run this to verify your Discord bot connection
// and list available channels.

import { initDiscord, disconnectDiscord } from "../src/services/discord.js";
import { config } from "../src/config/index.js";
import { logger } from "../src/utils/logger.js";
import { TextChannel, type Guild } from "discord.js";

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Discord Setup Verification");
  console.log("═══════════════════════════════════════\n");

  try {
    const client = await initDiscord();
    console.log(`✅ Bot connected as: ${client.user?.tag}\n`);

    // Fetch guild
    const guild: Guild = await client.guilds.fetch(config.discord.guildId);
    console.log(`✅ Server found: ${guild.name} (${guild.memberCount} members)\n`);

    // List all text channels
    const channels = guild.channels.cache
      .filter((ch): ch is TextChannel => ch instanceof TextChannel)
      .sort((a, b) => a.position - b.position);

    console.log("📋 Available text channels:\n");
    console.log("  Copy the IDs you need into your .env file:\n");

    for (const channel of channels.values()) {
      const category = channel.parent?.name || "No Category";
      console.log(`  #${channel.name.padEnd(30)} → ${channel.id}  (${category})`);
    }

    console.log("\n═══════════════════════════════════════");
    console.log("  Setup complete! Update .env with the channel IDs above.");
    console.log("═══════════════════════════════════════\n");
  } catch (error: any) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    console.error("\nTroubleshooting:");
    console.error("  1. Is DISCORD_BOT_TOKEN correct in .env?");
    console.error("  2. Has the bot been invited to your server?");
    console.error("  3. Is DISCORD_GUILD_ID correct?");
    console.error(
      "  4. Does the bot have 'Send Messages' and 'Read Message History' permissions?\n"
    );
  } finally {
    await disconnectDiscord();
    process.exit(0);
  }
}

main();
