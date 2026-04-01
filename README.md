# Common Chronicles Content Bot

**Notion → Discord auto-poster + cross-platform reminder system**

Reads your 3-Month Content Calendar from Notion and:
- **Auto-posts** to Discord channels (announcements, events, community updates)
- **Sends DM reminders** with pre-written copy for Twitter, LinkedIn, Instagram, WhatsApp
- **Announces events** (Story Circles, Failure Fridays) with rich embeds
- **Previews tomorrow's content** every evening at 8PM WAT

---

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Notion     │────▶│   CC Bot        │────▶│  Discord Server  │
│  Content     │     │  (Node.js)      │     │  - #announcements │
│  Calendar    │     │                 │     │  - #story-circle  │
│              │     │  Cron Jobs:     │     │  - #failure-friday│
└──────────────┘     │  08:00 reminders│     │  - #general       │
                     │  09:00 auto-post│     └──────────────────┘
                     │  20:00 preview  │
                     │  Sun 19:00 digest│────▶  DM Reminders
                     └─────────────────┘      (Twitter, LinkedIn,
                                               Instagram, etc.)
```

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd cc-bot
npm install
```

### 2. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click "New Integration"
3. Name it "CC Content Bot"
4. Select your workspace
5. Copy the **Internal Integration Secret**
6. **Important**: Go to your Content Calendar page in Notion → click "..." → "Connections" → Add your integration

### 3. Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click "New Application" → name it "CC Content Bot"
3. Go to "Bot" tab → click "Reset Token" → copy the token
4. Enable these **Privileged Gateway Intents**:
   - Message Content Intent
   - Server Members Intent
5. Go to "OAuth2" → "URL Generator"
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Read Message History`
6. Copy the generated URL and open it to invite the bot to your server

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual keys
```

### 5. Verify Discord Setup

```bash
npm run setup:discord
```

This will connect to Discord, list all channels with their IDs, and verify permissions.

### 6. Run the Bot

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run with hot reload (development) |
| `npm start` | Run in production mode |
| `npm run post:now` | Manually trigger today's content |
| `npm run check` | Preview the next 7 days of content |
| `npm run setup:discord` | Verify Discord connection & list channels |

## Schedule (Africa/Lagos timezone)

| Time | Action |
|------|--------|
| **08:00 WAT** | Morning check — sends DM reminders for ALL platforms |
| **09:00 WAT** | Auto-post — publishes Discord content to channels |
| **20:00 WAT** | Evening preview — DMs you tomorrow's content queue |
| **Sunday 19:00** | Weekly digest — upcoming events for the week |

## How It Works

### Content Flow

1. **You write content** in your Notion Content Calendar (the 3-Month Ops Plan format)
2. **Bot reads the calendar** daily, parsing entries by date and platform
3. **Discord content** → auto-posted to the right channel (#announcements, #story-circle, etc.)
4. **Other platforms** → bot sends you a Discord DM with the pre-written copy, ready to paste

### Platform Handling

| Platform | Action | Type |
|----------|--------|------|
| Discord | Auto-post to channel | Automated |
| Twitter/X | DM with tweet/thread copy | Reminder |
| LinkedIn | DM with caption | Reminder |
| Instagram | DM with caption + visual notes | Reminder |
| WhatsApp | DM with status text | Reminder |

### Event Detection

The bot automatically detects Story Circles and Failure Fridays from your calendar and:
- Posts rich embeds to the appropriate Discord channel
- Uses the CC color scheme (sage for Story Circle, gold for Failure Friday)
- Sends you advance reminders

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Create a new project on [railway.app](https://railway.app)
3. Connect your repo
4. Add environment variables from `.env`
5. Deploy — Railway keeps it running 24/7

### Render

1. Create a new "Background Worker" on [render.com](https://render.com)
2. Connect repo, set build command: `npm install`
3. Set start command: `npm start`
4. Add env vars

### VPS / Self-hosted

```bash
# Use PM2 for process management
npm install -g pm2
pm2 start npm --name "cc-bot" -- start
pm2 save
pm2 startup
```

## Next Steps (Phase 2+)

- [ ] AI content generation with Claude/Gemini API
- [ ] Auto-publish to Twitter via X API v2
- [ ] Auto-publish to Medium & Hashnode via their APIs
- [ ] Notion status updates (mark items as "posted")
- [ ] Content database (separate from the calendar page) for better querying
- [ ] Slash commands in Discord (`/next-post`, `/schedule`, `/content-idea`)

## Built for Common Chronicles

🧡 Cream `#F5F0E8` · 🖤 Ink `#1A1A1A` · 🧡 Coral `#E07A5F` · 💚 Sage `#7BAF7B`

Using Newsreader + Inter typography.
