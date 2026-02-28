# Claude Executive Assistant — Setup & Configuration

AI-powered executive assistant with relationship intelligence engine. Operates inside Claude.ai, orchestrates through Make.com, stores structured data in Notion, and ingests from Teams, Outlook, and Pipedrive.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd claude-ea-setup
npm install

# 2. Configure credentials
cp .env.example .env
# Fill in your API keys (see CLAUDE.md for details)

# 3. Create Notion databases
npm run setup:databases
# Copy the printed database IDs into .env

# 4. Seed test data
npm run setup:seed

# 5. Test fact extraction quality
npm run test:extraction

# 6. Test relationship intelligence
node scripts/04-test-relationship-query.js "Dave"

# 7. Generate Make.com blueprints
npm run generate:blueprints

# 8. Import blueprints into Make.com and wire connections
```

## Architecture

See `CLAUDE.md` for the complete build plan, database schemas, prompt specifications, and scenario details.

## Credentials Needed

| Service | What | Where to Get It |
|---------|------|-----------------|
| Notion | Integration token | notion.so/my-integrations |
| Anthropic | API key | console.anthropic.com |
| Azure AD | App registration (client ID, tenant ID, secret) | portal.azure.com |
| Pipedrive | API token | Pipedrive → Settings → API |
| Make.com | API token | Make → Profile → API Access |

## 13 Make.com Scenarios

| ID | Name | Trigger | Purpose |
|----|------|---------|---------|
| EA-01 | Daily Intelligence Briefing | Schedule/Webhook | Morning briefing with tasks, commitments, deals |
| EA-02 | Teams Transcript Ingestion | Schedule (30m) | Polls Teams for new transcripts |
| EA-03 | Fact Extraction Pipeline | Chained/Webhook | **THE CORE** — extracts structured facts |
| EA-04 | Outlook Email Ingestion | Schedule (15m) | Polls Outlook for relevant emails |
| EA-05 | Relationship Intelligence Query | Webhook | Assembles relationship briefs with sources |
| EA-06 | Commitment Tracker | Webhook | Surfaces overdue/upcoming commitments |
| EA-07 | Task Manager | Webhook | Full CRUD on Tasks |
| EA-08 | Knowledge Base Ops | Webhook | Search and create KB articles |
| EA-09 | Teams Messenger | Webhook | Send DMs and channel posts |
| EA-10 | Follow-Up Pipeline | Webhook | Post-meeting orchestration |
| EA-11 | Relationship CRUD | Webhook | Create/update relationships |
| EA-12 | Pipedrive Sync | Schedule (1h) | Syncs Pipedrive data into EA |
| EA-13 | Deal Intelligence | Webhook | Deep deal analysis with relationship context |
