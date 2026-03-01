# CLAUDE.md — Claude Executive Assistant with Relationship Intelligence

## Project Overview

You are building the **Claude Executive Assistant (Claude EA)** — an AI-powered executive assistant with a relationship intelligence engine at its core. The system runs inside Claude.ai, orchestrates through Make.com, and stores structured data in Notion. It ingests data from **Microsoft Teams transcripts, Outlook email, Teams chats, and Pipedrive CRM**, extracts structured facts from every interaction, and builds living relationship profiles that are queryable through natural conversation.

**This is NOT a task manager with an AI wrapper.** The fundamental innovation is the **Fact Extraction Pipeline** — every interaction (transcript, email, deal activity) gets processed into individual structured facts (commitments, decisions, concerns, feedback, priorities) that are source-grounded and tied to specific relationships. Relationship profiles assemble on-demand from those facts.

### Owner
Brian — Founder of ManageAI and Sanctuary Recovery Centers. Primary user of the EA. All interactions happen through Claude.ai with Make MCP connector.

### Architecture
```
Brian → Claude.ai (interface) → Make MCP (trigger) → Make.com Scenarios → APIs
                                                          ↓
                                              ┌─────────────────────────────┐
                                              │  DATA SOURCES (Ingestion)   │
                                              │  • Teams Transcripts (Graph)│
                                              │  • Outlook Email (Graph)    │
                                              │  • Pipedrive CRM (REST)     │
                                              │  • Teams Chats (Graph)      │
                                              └──────────┬──────────────────┘
                                                         ↓
                                              ┌─────────────────────────────┐
                                              │  EA-03: FACT EXTRACTION     │
                                              │  (Claude API — THE CORE)    │
                                              │  Interaction → Structured   │
                                              │  Facts with source grounding│
                                              └──────────┬──────────────────┘
                                                         ↓
                                              ┌─────────────────────────────┐
                                              │  NOTION (Structured Store)  │
                                              │  • Relationships DB (hub)   │
                                              │  • Facts DB (intelligence)  │
                                              │  • Interactions DB (sources)│
                                              │  • Tasks DB (action items)  │
                                              │  • Knowledge Base DB        │
                                              └─────────────────────────────┘
```

---

## Environment Setup

### Prerequisites
- Node.js 18+
- npm

### Install Dependencies
```bash
npm install
```

### Required Packages
```json
{
  "@notionhq/client": "^2.2.0",
  "dotenv": "^16.0.0",
  "@anthropic-ai/sdk": "^0.30.0",
  "axios": "^1.6.0",
  "pipedrive": "^13.0.0"
}
```

### Environment Variables (.env)
Create a `.env` file in the project root. **Never commit this file.** The `.gitignore` must include `.env`.

```env
# ═══════ NOTION ═══════
NOTION_TOKEN=ntn_REPLACE_ME
# These get populated by Script 01 after database creation:
NOTION_RELATIONSHIPS_DB=
NOTION_FACTS_DB=
NOTION_INTERACTIONS_DB=
NOTION_TASKS_DB=
NOTION_KB_DB=

# ═══════ ANTHROPIC ═══════
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# ═══════ MICROSOFT GRAPH (Azure AD App) ═══════
AZURE_CLIENT_ID=REPLACE_ME
AZURE_TENANT_ID=REPLACE_ME
AZURE_CLIENT_SECRET=REPLACE_ME

# ═══════ PIPEDRIVE ═══════
PIPEDRIVE_API_TOKEN=REPLACE_ME
PIPEDRIVE_DOMAIN=REPLACE_ME

# ═══════ MAKE.COM ═══════
MAKE_API_TOKEN=REPLACE_ME
MAKE_TEAM_ID=REPLACE_ME
```

---

## Project Structure

```
claude-ea-setup/
├── CLAUDE.md                         ← YOU ARE HERE
├── .env                              ← credentials (gitignored)
├── .gitignore
├── package.json
├── README.md
│
├── scripts/
│   ├── 01-create-notion-databases.js ← creates all 5 DBs with full schemas
│   ├── 02-seed-test-data.js          ← populates DBs with realistic test data
│   ├── 03-test-fact-extraction.js    ← tests extraction prompt against samples
│   ├── 04-test-relationship-query.js ← tests relationship intelligence assembly
│   ├── 05-test-graph-api.js          ← validates Microsoft Graph connectivity
│   ├── 06-test-pipedrive-sync.js     ← validates Pipedrive connectivity + sync
│   ├── 07-generate-make-blueprints.js← generates all 13 Make scenario JSONs
│   └── utils/
│       ├── notion-client.js          ← shared Notion client + helpers
│       ├── anthropic-client.js       ← shared Anthropic client
│       ├── graph-client.js           ← Microsoft Graph auth + helpers
│       └── pipedrive-client.js       ← Pipedrive API client + helpers
│
├── prompts/
│   ├── fact-extraction.md            ← THE most important file in the project
│   ├── relationship-brief.md         ← intelligence brief formatting prompt
│   ├── daily-briefing.md             ← morning briefing formatting prompt
│   ├── meeting-recap.md              ← follow-up recap drafting prompt
│   └── deal-intelligence.md          ← Pipedrive deal analysis prompt
│
├── blueprints/
│   ├── EA-01-daily-intelligence-briefing.json
│   ├── EA-02-teams-transcript-ingestion.json
│   ├── EA-03-fact-extraction-pipeline.json
│   ├── EA-04-outlook-email-ingestion.json
│   ├── EA-05-relationship-intelligence-query.json
│   ├── EA-06-commitment-tracker.json
│   ├── EA-07-task-manager.json
│   ├── EA-08-knowledge-base-ops.json
│   ├── EA-09-teams-messenger.json
│   ├── EA-10-meeting-follow-up-pipeline.json
│   ├── EA-11-relationship-crud.json
│   ├── EA-12-pipedrive-sync.json
│   └── EA-13-deal-intelligence.json
│
├── test-data/
│   ├── sample-transcript-01.txt      ← real or realistic meeting transcript
│   ├── sample-transcript-02.txt
│   ├── sample-transcript-03.txt
│   ├── sample-email-01.txt           ← real or realistic email thread
│   ├── sample-email-02.txt
│   └── sample-pipedrive-deal.json    ← sample deal + activity data
│
└── output/
    ├── database-ids.json             ← generated by Script 01
    ├── extraction-results/           ← output from Script 03
    └── blueprint-validation/         ← output from Script 07
```

---

## Script Specifications

### Script 01: Create Notion Databases

**File:** `scripts/01-create-notion-databases.js`

**Purpose:** Creates all 5 Notion databases with complete schemas, property types, select options, relations, and rollups. Outputs database IDs to `output/database-ids.json` and prints them for .env population.

**Important:** The Notion API requires a parent page to create databases. The script should:
1. First create a top-level page called "Claude EA" as the workspace
2. Create each database as a child of that page
3. Create Relations AFTER all databases exist (you need the IDs first)
4. Create Rollups AFTER relations exist

**Database 1: Relationships (THE HUB)**

This is the central entity. Every person, company, or organization gets a record.

| Property | Type | Configuration |
|----------|------|---------------|
| Name | title | — |
| Type | select | Options: Person, Company, Partner, Investor, Internal Team, Vendor, Other |
| Company | rich_text | Organization affiliation |
| Email | email | Primary email |
| Phone | phone_number | Primary phone |
| Stage | select | Options: Lead, Active, Engaged, Closed Won, Closed Lost, Dormant, Internal |
| Owner | rich_text | Account owner (text for V1, Person type later) |
| Last Interaction | date | Auto-updated when new facts are extracted |
| Tags | multi_select | Options: ManageAI, Sanctuary, New Freedom, Pipedrive, Client, Prospect |
| Notes | rich_text | Manual notes |
| Pipedrive Person ID | number | For sync — stores Pipedrive person_id |
| Pipedrive Org ID | number | For sync — stores Pipedrive org_id |

Relations (add after all DBs created):
- Facts ← relation to Facts DB
- Interactions ← relation to Interactions DB  
- Tasks ← relation to Tasks DB

Rollups (add after relations):
- Open Commitments: rollup on Facts relation, filter category=Commitment AND status=Active, count
- Interaction Count: rollup on Interactions relation, count

**Database 2: Facts (THE INTELLIGENCE LAYER)**

Every extracted claim, commitment, decision, concern. The atomic unit of the system.

| Property | Type | Configuration |
|----------|------|---------------|
| Fact | title | The extracted claim in concise form |
| Category | select | Options: Commitment, Decision, Concern, Feedback, Priority, Preference, Context, Request, Milestone |
| Relationship | relation | → Relationships DB |
| Source Interaction | relation | → Interactions DB |
| Speaker | rich_text | Who said/wrote this |
| Source Timestamp | rich_text | "HH:MM" for transcripts, "paragraph N" for emails, "activity note" for Pipedrive |
| Confidence | select | Options: High, Medium, Low |
| Status | select | Options: Active, Fulfilled, Expired, Superseded, Disputed |
| Due Date | date | For commitments/requests with deadlines |
| Extracted Date | date | When this fact was extracted (auto-set by pipeline) |
| Sentiment | select | Options: Positive, Neutral, Negative, Urgent |
| Tags | multi_select | Flexible: pricing, product, timeline, budget, legal, technical, etc. |

**Database 3: Interactions (SOURCE REGISTRY)**

Every processed meeting, email, chat, or Pipedrive activity. Facts link back here for source grounding.

| Property | Type | Configuration |
|----------|------|---------------|
| Title | title | Interaction name |
| Type | select | Options: Meeting Transcript, Email, Teams Chat, Pipedrive Activity, Pipedrive Deal Update, Manual Note |
| Date | date | When the interaction occurred |
| Source | select | Options: Teams Transcription, Outlook, Teams Chat, Pipedrive, Manual |
| Participants | multi_select | People involved |
| Relationships | relation | → Relationships DB (multi — which relationships were involved) |
| Summary | rich_text | AI-generated one-paragraph summary |
| Raw Content | rich_text | Full or truncated source content |
| External ID | rich_text | Teams Meeting ID / Email Message ID / Pipedrive Activity ID — for deduplication |
| Processed | checkbox | Whether fact extraction has been completed |
| Facts Extracted | number | Count of facts extracted (updated after processing) |

**Database 4: Tasks**

| Property | Type | Configuration |
|----------|------|---------------|
| Name | title | Task description |
| Status | status | Options: To Do, In Progress, Done, Blocked |
| Priority | select | Options: P0 (Critical), P1 (High), P2 (Medium), P3 (Low) |
| Due Date | date | Deadline |
| Project | select | Options: ManageAI, Sanctuary, New Freedom, Personal, Other |
| Relationship | relation | → Relationships DB |
| Source Interaction | relation | → Interactions DB |
| Assigned To | rich_text | Person name (text for V1) |
| Notes | rich_text | Additional context |
| Created By | select | Options: Manual, Claude EA, Fact Extraction, Pipedrive Sync |

**Database 5: Knowledge Base**

| Property | Type | Configuration |
|----------|------|---------------|
| Title | title | Article title |
| Category | select | Options: Processes, Technical, Clients, Legal, HR, General, Pipedrive, Integrations |
| Tags | multi_select | Flexible tagging |
| Created By | select | Options: Manual, Claude EA |

Body content is stored as Notion blocks (paragraphs, headings, callouts) under each page, not as a property.

**Output:** Write `output/database-ids.json`:
```json
{
  "workspace_page_id": "...",
  "relationships_db": "...",
  "facts_db": "...",
  "interactions_db": "...",
  "tasks_db": "...",
  "kb_db": "..."
}
```

Print instructions: "Add these to your .env file: NOTION_RELATIONSHIPS_DB=... NOTION_FACTS_DB=... etc."

---

### Script 02: Seed Test Data

**File:** `scripts/02-seed-test-data.js`

**Purpose:** Populates all databases with realistic test data so you can immediately test relationship intelligence queries without waiting for real transcripts to flow through.

**Create these records:**

**Relationships (8):**
1. Dave — Person, ManageAI, Active, Internal Team
2. Chad — Person, ManageAI, Active, Internal Team
3. Tony — Person, Sunstate Medical Transport, Engaged, Client
4. Jacob — Person, ManageAI, Active, Internal Team
5. Robert — Person, ManageAI, Active, Internal Team
6. Pat — Person, ManageAI, Active, Internal Team
7. Sunstate Medical Transport — Company, Engaged, Client
8. Cornerstone General Contractors — Company, Active, Client

**Interactions (5):**
1. "Sunstate Demo Walkthrough" — Meeting Transcript, Feb 28, Participants: Brian + Tony
2. "ManageAI Founders Sync" — Meeting Transcript, Feb 25, Participants: Brian + Chad + Dave
3. "Cornerstone Contract Review" — Email, Feb 24, Participants: Brian + Cornerstone
4. "Expansion Planning Discussion" — Meeting Transcript, Feb 20, Participants: Brian + Dave
5. "Sunstate Pricing Follow-up" — Email, Feb 26, Participants: Brian + Tony

**Facts (25 — spread across relationships and categories):**

Sunstate/Tony facts:
- "Pilot will cover Phoenix, Scottsdale, and Mesa facilities" — Decision, Tony, High, Positive
- "Start date March 15 for pilot" — Commitment, Tony, High, Positive, due: 2026-03-15
- "Approved Retell integration for call-ahead system" — Decision, Tony, High, Positive
- "Wants pricing finalized by March 7" — Request, Tony, High, Neutral, due: 2026-03-07
- "Budget is $3,500/month for the pilot" — Context, Tony, High, Neutral

Dave facts:
- "Budget for Q2 expansion is $200K" — Context, Dave, High, Neutral
- "Interested in healthcare IT partnership" — Priority, Dave, High, Positive
- "Wants capabilities deck by end of February" — Commitment (by Brian), Dave, Medium, Neutral, due: 2026-02-28, status: Active (overdue!)
- "Prefers Monday morning calls" — Preference, Dave, Medium, Neutral
- "Concerned about hiring timeline for Q2" — Concern, Dave, High, Negative

Chad facts:
- "Concerned about pricing model sustainability" — Concern, Chad, High, Negative
- "Wants to prioritize enterprise clients for Q2" — Priority, Chad, High, Neutral
- "Approved ManageAI rebrand concept" — Decision, Chad, High, Positive
- "Committed to finalizing product roadmap by March 10" — Commitment, Chad, High, Neutral, due: 2026-03-10

Cornerstone facts:
- "Contract value is $8,500/month" — Context, Cornerstone, High, Neutral
- "Wants automated proposal generation" — Priority, Cornerstone, High, Positive
- "Concerned about data security for contract storage" — Concern, Cornerstone, Medium, Negative
- "Approved Phase 1 SOW" — Decision, Cornerstone, High, Positive
- "Go-live target is March 20" — Commitment, Cornerstone, Medium, Neutral, due: 2026-03-20

Additional facts across relationships to test cross-cutting queries:
- "ManageAI should support Zapier in addition to Make and n8n" — Feedback, Dave, Medium, Neutral
- "Jacob completed the Make builder refactor" — Milestone, Jacob, High, Positive
- "Robert's go-to-market plan deliverable is due March 1" — Commitment, Robert, High, Neutral, due: 2026-03-01
- "Pat suggested adding consumer app patterns to client demos" — Feedback, Pat, Medium, Positive
- "Tony mentioned competitor Halo Health is also pitching Sunstate" — Context, Tony, Medium, Negative
- "Cornerstone wants bi-weekly status calls" — Preference, Cornerstone, High, Neutral
- "Dave recommended reaching out to Phoenix Health Systems" — Request, Dave, Medium, Positive

**Tasks (10):**
1. "Finalize Sunstate pilot pricing" — P1, due Mar 7, ManageAI, linked to Sunstate + Sunstate Demo interaction
2. "Set up 3 facility Retell agents" — P2, due Mar 12, ManageAI, linked to Sunstate
3. "Draft Sunstate SOW for Tony's review" — P1, due Mar 5, ManageAI, linked to Sunstate
4. "Send Dave capabilities deck" — P1, due Feb 28 (OVERDUE), ManageAI, linked to Dave
5. "Review Cornerstone contract security requirements" — P2, due Mar 10, ManageAI, linked to Cornerstone
6. "Update ManageAI pricing page" — P3, no due date, ManageAI
7. "Approve Jacob's Make builder PR" — P2, due Mar 3, ManageAI, linked to Jacob
8. "Prepare ABCAC certification demo" — P2, due Mar 8, ManageAI
9. "Follow up with Robert on GTM deliverable" — P1, due Mar 1, ManageAI, linked to Robert
10. "Research Phoenix Health Systems per Dave's rec" — P3, no due date, ManageAI, linked to Dave

Link facts to their source interactions. Link tasks to relationships and source interactions. Make sure the relations are properly set.

---

### Script 03: Test Fact Extraction

**File:** `scripts/03-test-fact-extraction.js`

**Purpose:** The most important test script. Takes sample transcripts/emails from `test-data/`, sends them through the fact extraction prompt via Anthropic API, validates the output structure, and displays results in a readable format.

**Behavior:**
1. Read the fact extraction prompt from `prompts/fact-extraction.md`
2. For each file in `test-data/`:
   - Detect type from filename (transcript vs email vs pipedrive)
   - Send to Claude API with the extraction prompt as system message
   - Parse the JSON response
   - Validate structure: every fact has claim, category, relationship, speaker, timestamp, confidence, sentiment
   - Validate categories are from the allowed set
   - Validate confidence is High/Medium/Low
   - Count facts by category
   - Display results in a clean table format
3. Save results to `output/extraction-results/{filename}.json`
4. Print summary: total facts extracted, by category, any validation errors

**Use the Anthropic SDK:**
```javascript
const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: process.env.CLAUDE_MODEL,
  max_tokens: 8000,
  temperature: 0,
  system: systemPrompt,
  messages: [{ role: "user", content: `Process this ${type}:\n\n${content}` }],
});
```

**Important:** If the response contains markdown code fences (```json), strip them before parsing. Claude sometimes wraps JSON in code blocks despite being told not to.

---

### Script 04: Test Relationship Intelligence Query

**File:** `scripts/04-test-relationship-query.js`

**Purpose:** Tests the full relationship intelligence query flow against the seeded Notion data. Takes a relationship name as argument, queries Facts DB + Tasks DB + Interactions DB, assembles the profile, and sends it through the brief-formatting prompt.

**Behavior:**
1. Accept relationship name as CLI argument: `node scripts/04-test-relationship-query.js "Dave"`
2. Query Notion Relationships DB for the name
3. Query Facts DB filtered by that relationship, sorted by Extracted Date descending
4. Query Tasks DB filtered by that relationship, Status != Done
5. Query Interactions DB filtered by that relationship, sorted by Date descending, limit 5
6. Assemble into a structured profile object:
   ```json
   {
     "relationship": { "name": "...", "type": "...", "stage": "...", "last_interaction": "..." },
     "facts_by_category": {
       "commitments": [...],
       "decisions": [...],
       "concerns": [...],
       "context": [...],
       ...
     },
     "open_tasks": [...],
     "recent_interactions": [...],
     "alerts": {
       "overdue_commitments": [...],
       "stale_contact": true/false,
       "unresolved_concerns": [...]
     }
   }
   ```
7. Send to Claude API with the relationship-brief prompt
8. Print the formatted intelligence brief
9. Save to `output/relationship-brief-{name}.md`

---

### Script 05: Test Graph API

**File:** `scripts/05-test-graph-api.js`

**Purpose:** Validates Microsoft Graph API connectivity. Tests both delegated (user) and application-level permissions.

**Behavior:**
1. Authenticate using client credentials flow (application permissions):
   ```
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
   grant_type=client_credentials
   client_id={AZURE_CLIENT_ID}
   client_secret={AZURE_CLIENT_SECRET}
   scope=https://graph.microsoft.com/.default
   ```
2. Test: `GET /me` (should fail with app-only token — that's expected)
3. Test: `GET /users` (should succeed with app permissions)
4. Test: `GET /users/{user_id}/onlineMeetings` — check if meeting data accessible
5. Test: `GET /users/{user_id}/messages` — check if mail is accessible
6. Print results: which endpoints work, which permissions are missing
7. If transcript endpoint fails, print specific guidance on what Azure AD permissions to add

**Note:** For delegated permissions (sending messages, reading mail as a user), Make.com handles the OAuth flow interactively. This script only tests app-level permissions that the scheduled ingestion scenarios use.

---

### Script 06: Test Pipedrive Sync

**File:** `scripts/06-test-pipedrive-sync.js`

**Purpose:** Validates Pipedrive API connectivity and tests the sync logic that will power EA-12.

**Behavior:**
1. Connect to Pipedrive API using the API token
2. Test: `GET /persons` — list all persons, print count
3. Test: `GET /organizations` — list all orgs, print count
4. Test: `GET /deals` — list all deals with their stages, print summary
5. Test: `GET /activities` — list recent activities (calls, emails, meetings), print last 10
6. Test: `GET /deals/{id}/flow` — get deal timeline for a specific deal
7. Test: `GET /notes` — list recent notes
8. For each person found:
   - Check if a matching Relationship exists in Notion (by name or Pipedrive Person ID)
   - If not, flag as "new — will be created on sync"
   - If yes, flag as "exists — will be updated on sync"
9. Print sync plan: N persons to create, N to update, N deals to process, N activities to extract facts from
10. Do NOT execute the sync — just validate and plan

**Pipedrive API basics:**
```javascript
const axios = require("axios");
const PIPEDRIVE_BASE = `https://${process.env.PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

async function pipedrive(endpoint, params = {}) {
  const response = await axios.get(`${PIPEDRIVE_BASE}${endpoint}`, {
    params: { api_token: process.env.PIPEDRIVE_API_TOKEN, ...params }
  });
  return response.data;
}
```

**Pipedrive data mapping to Notion:**

| Pipedrive Entity | Maps To | Notes |
|------------------|---------|-------|
| Person | Relationship (Type=Person) | Sync name, email, phone, org affiliation |
| Organization | Relationship (Type=Company) | Sync name, address |
| Deal | Multiple Facts on the Relationship | Stage changes = Decisions, Deal value = Context, Expected close = Commitment |
| Activity (call/meeting) | Interaction + Facts | Activity notes get fact-extracted |
| Activity (email tracked) | Interaction + Facts | Email content gets fact-extracted |
| Note | Interaction + Facts | Note content gets fact-extracted |
| Deal stage change | Fact (category=Milestone or Decision) | "Deal moved to Proposal stage" |

---

### Script 07: Generate Make Blueprints

**File:** `scripts/07-generate-make-blueprints.js`

**Purpose:** Generates all 13 Make.com scenario blueprint JSONs ready for import. Uses the database IDs from `output/database-ids.json` and the prompts from `prompts/`.

**Generates these blueprints:**

Each blueprint follows Make.com's JSON structure:
```json
{
  "name": "EA-XX — Scenario Name",
  "flow": [ { "id": 1, "module": "...", "version": 1, "parameters": {}, "mapper": {}, "metadata": {} } ],
  "metadata": { "instant": true, "version": 1, "scenario": { "roundtrips": 1, "maxErrors": 3, "autoCommit": true } }
}
```

**Scenario Specifications:**

#### EA-01: Daily Intelligence Briefing
- Trigger: Webhook (Claude MCP) or Schedule (7 AM MST)
- Modules: Webhook → Query Tasks (open, by priority) → Query Facts (Commitments, Active, due ≤ today+2) → Query Relationships (Last Interaction > 7 days, Stage=Active/Engaged) → Query Pipedrive Deals (open, expected close this week) → Aggregate → Claude API (daily-briefing prompt) → Webhook Response
- Webhook payload: `{ "date": "YYYY-MM-DD", "scope": "full|tasks|meetings|commitments|deals" }`

#### EA-02: Teams Transcript Ingestion
- Trigger: Schedule (every 30 min, 7 AM - 7 PM MST)
- Modules: Schedule → HTTP Graph API (list meetings last 30 min) → Iterator → Check dedup (query Interactions DB by External ID) → HTTP Graph API (get transcript, VTT format) → Text Transform (strip VTT timestamps, keep speaker labels) → Notion Create Interaction (Type=Meeting Transcript) → HTTP Call EA-03 webhook (chain to extraction) → Sleep 350ms
- Dedup: skip if Interaction with matching External ID exists

#### EA-03: Fact Extraction Pipeline (THE CORE)
- Trigger: Webhook (chained from EA-02, EA-04, EA-12, or direct Claude MCP call)
- Webhook payload: `{ "interaction_id": "notion_page_id", "type": "transcript|email|chat|pipedrive_activity|pipedrive_deal", "raw_content": "optional" }`
- Modules:
  1. Webhook Trigger
  2. Router: has raw_content? → Route A (skip fetch) / Route B (fetch from Notion)
  3. [Route B] Notion: Get Interaction block content → concatenate text
  4. Notion: Get Interaction metadata (participants, date, type)
  5. HTTP: Claude API — structured fact extraction (temperature: 0, max_tokens: 8000, system prompt from prompts/fact-extraction.md)
  6. JSON Parse response
  7. Iterator: facts array
  8. For each fact: Notion query Relationships DB by name → resolve to existing record or create new
  9. Notion: Create Fact page (link to Relationship + Source Interaction)
  10. Router: has action_items? → Yes: Iterator → Create Task per item / No: skip
  11. Notion: Update Interaction (Processed=true, Summary=extracted summary, Facts Extracted=count)
  12. Notion: Update Relationship Last Interaction date
  13. Webhook Response: `{ "success": true, "facts_extracted": N, "tasks_created": N, "summary": "..." }`
- Error handler: BasicFeeder on Claude API call → return structured error

#### EA-04: Outlook Email Ingestion
- Trigger: Schedule (every 15 min, 7 AM - 7 PM MST)
- Modules: Schedule → HTTP Graph API (list messages, receivedDateTime ≥ now-15min) → Filter (from/to matches known Relationship emails OR message is flagged) → Iterator → Check dedup → Notion Create Interaction (Type=Email) → HTTP Call EA-03 → Sleep 350ms
- Graph endpoint: `GET /me/messages?$filter=receivedDateTime ge {datetime}&$select=subject,from,toRecipients,body,receivedDateTime&$top=50`

#### EA-05: Relationship Intelligence Query
- Trigger: Webhook (Claude MCP)
- Webhook payload: `{ "query": "Dave", "categories": ["all"], "include_sources": true }`
- Modules:
  1. Webhook → Notion: Query Relationships DB (Name contains query)
  2. Notion: Query Facts DB (filter by Relationship, sort by Extracted Date desc)
  3. Notion: Query Tasks DB (filter by Relationship, Status ≠ Done)
  4. Notion: Query Interactions DB (filter by Relationships, limit 5, sort Date desc)
  5. Notion: Query Pipedrive deal data if Pipedrive IDs present on relationship
  6. Set Variable: assemble profile JSON
  7. HTTP: Claude API (relationship-brief prompt, temperature 0.3)
  8. Webhook Response: formatted brief

#### EA-06: Commitment Tracker
- Trigger: Webhook (Claude MCP or chained from EA-01)
- Webhook payload: `{ "scope": "overdue|this_week|upcoming|all", "relationship": "optional filter" }`
- Modules: Webhook → Query Facts (category=Commitment, status=Active, sorted by Due Date) → Router (overdue / due this week / upcoming based on date comparison) → For each: get linked Relationship name → Aggregate → Webhook Response with structured commitment report

#### EA-07: Task Manager (CRUD)
- Trigger: Webhook
- Webhook payload: `{ "action": "create|update|delete|list|search", "task": { "name": "", "status": "", "priority": "", "due_date": "", "project": "", "notes": "" }, "task_id": "for update/delete", "query": "for search" }`
- Modules: Webhook → 5-way Router by action → Notion CRUD operations → Webhook Response
- Delete = archive (set archived: true), never hard delete

#### EA-08: Knowledge Base Operations
- Trigger: Webhook
- Webhook payload: `{ "action": "search|create|update", "query": "search terms", "content": { "title": "", "category": "", "tags": [], "body": "" } }`
- Search: Query KB DB by title contains + optional category filter → Get block content for top 3 → return
- Create: Create KB page + append body as paragraph blocks

#### EA-09: Teams Messenger
- Trigger: Webhook
- Webhook payload: `{ "action": "send_dm|send_channel|list_channels", "to": "user email or channel id", "message": "HTML content", "subject": "optional" }`
- DM flow: POST /chats (create 1:1) → POST /chats/{id}/messages
- Channel flow: POST /teams/{team_id}/channels/{channel_id}/messages
- All messages append footer: "Sent via Claude EA"
- After sending: log interaction in Interactions DB, update Relationship Last Interaction

#### EA-10: Meeting Follow-Up Pipeline
- Trigger: Webhook (Claude MCP or chained from EA-02)
- Webhook payload: `{ "meeting_id": "interaction_id", "send_recap": true, "attendees": ["email1", "email2"] }`
- Modules: Webhook → Check if EA-03 ran (Processed flag) → If not: call EA-03 → Get extracted facts and action items → Create tasks via EA-07 for each action item → If send_recap: Claude API drafts recap → Send to each attendee via EA-09 → For each attendee matching a Relationship: log interaction → Webhook Response with summary

#### EA-11: Relationship CRUD
- Trigger: Webhook
- Webhook payload: `{ "action": "create|update|lookup|list_stale", "relationship": { "name": "", "type": "", "company": "", "email": "", "stage": "" } }`
- Lookup: query by name, email, or company
- List stale: Last Interaction > 7 days AND Stage in (Active, Engaged)

#### EA-12: Pipedrive Sync (NEW)
- Trigger: Schedule (every 1 hour) or Webhook (manual trigger from Claude)
- Purpose: Syncs Pipedrive data into the EA relationship intelligence system
- Modules:
  1. Schedule/Webhook Trigger
  2. HTTP: Pipedrive GET /recents (items modified since last sync) — covers persons, orgs, deals, activities, notes
  3. Router: entity type
  4. **Persons route:** For each modified person → check Notion Relationships DB by Pipedrive Person ID → if exists: update fields → if new: create Relationship record with Pipedrive Person ID stored
  5. **Organizations route:** Same pattern → create/update Relationship records with Pipedrive Org ID
  6. **Activities route:** For each new activity (call, meeting, email) → create Interaction record (Type=Pipedrive Activity) → chain to EA-03 for fact extraction with activity note as raw_content
  7. **Deals route:** For each modified deal → create Interaction record (Type=Pipedrive Deal Update) with deal details as content → chain to EA-03 → additionally create explicit Facts: "Deal {name} moved to {stage}" (Decision), "Deal value: ${amount}" (Context), "Expected close: {date}" (Commitment)
  8. **Notes route:** For each new note → create Interaction → chain to EA-03
  9. Store last sync timestamp in Make data store for next run
  10. Webhook Response: `{ "synced": { "persons": N, "orgs": N, "activities": N, "deals": N, "notes": N } }`

**Pipedrive API endpoints used:**
- `GET /recents?since_timestamp={iso}&items=person,organization,deal,activity,note`
- `GET /persons/{id}` — full person details
- `GET /organizations/{id}` — full org details
- `GET /deals/{id}` — deal details with stage
- `GET /deals/{id}/flow` — deal timeline
- `GET /activities/{id}` — activity details with note
- `GET /notes/{id}` — note content

#### EA-13: Deal Intelligence (NEW)
- Trigger: Webhook (Claude MCP)
- Purpose: Provides deep deal intelligence by assembling Pipedrive deal data + all related facts from the EA
- Webhook payload: `{ "query": "Sunstate" or "deal_id": 123, "include_timeline": true }`
- Modules:
  1. Webhook → search Pipedrive deals by name or ID
  2. GET deal details + deal flow (timeline)
  3. GET deal participants → resolve to Relationships
  4. Query Facts DB for all facts linked to deal participants
  5. Query Tasks DB for open tasks linked to deal relationships
  6. Assemble deal intelligence profile
  7. Claude API: format deal brief with deal-intelligence prompt (temperature 0.3)
  8. Webhook Response: formatted deal intelligence brief

---

## Prompts

### prompts/fact-extraction.md

```markdown
You are a relationship intelligence analyst processing interactions for Brian, founder of ManageAI and Sanctuary Recovery Centers.

Your job is to extract STRUCTURED FACTS from the interaction below. Every fact must be:
1. A specific, concrete claim — not a vague summary
2. Attributed to a specific speaker
3. Categorized precisely
4. Grounded with a source reference (timestamp for transcripts, paragraph for emails, activity type for Pipedrive)

CATEGORIES:
- Commitment: A promise or agreement to do something (by either party). MUST include who committed and what.
- Decision: A definitive choice or agreement reached. Must be stated, not implied.
- Concern: A worry, objection, risk, or pushback raised by someone.
- Feedback: Product feedback, service feedback, or process feedback.
- Priority: Something someone explicitly stated as important or a goal.
- Preference: How someone likes to work, communicate, or approach things.
- Context: Important background information (budget numbers, timelines, team size, deal values, etc.)
- Request: Something someone asked for that isn't a commitment yet.
- Milestone: A completed achievement or checkpoint (including deal stage changes).

RETURN FORMAT (JSON only, no markdown, no preamble, no code fences):
{
  "facts": [
    {
      "claim": "Concise factual statement",
      "category": "Commitment|Decision|Concern|Feedback|Priority|Preference|Context|Request|Milestone",
      "relationship": "Person or company name this fact belongs to",
      "speaker": "Who said/wrote this",
      "timestamp": "HH:MM for transcripts, 'paragraph N' for emails, 'activity' for Pipedrive",
      "confidence": "High|Medium|Low",
      "sentiment": "Positive|Neutral|Negative|Urgent",
      "due_date": "YYYY-MM-DD or null (for commitments/requests with deadlines)",
      "tags": ["relevant", "topic", "tags"]
    }
  ],
  "action_items": [
    {
      "title": "Specific actionable task",
      "owner": "Person responsible (default to Brian if unclear)",
      "priority": "P1|P2|P3",
      "due_date": "YYYY-MM-DD or null",
      "relationship": "Related person/company"
    }
  ],
  "summary": "One paragraph summary of the interaction (2-4 sentences)"
}

RULES:
1. Extract EVERY notable fact — err on the side of more facts, not fewer
2. Commitments are the highest-priority category — never miss a promise
3. If someone says "I'll" or "we'll" or "let's" — that's likely a Commitment
4. If someone says "I'm worried about" or "the risk is" — that's a Concern
5. Budget numbers, headcount, dates, deal values, and specific metrics are always Context facts
6. Don't extract pleasantries, small talk, or logistical coordination ("let's hop on a call") as facts
7. If a fact supersedes a previous one (e.g., deadline moved), note "supersedes" in tags
8. For commitments, always try to extract a due_date even if approximate
9. confidence=High means explicitly stated. Medium means clearly implied. Low means inferred from context.
10. Each fact should stand alone — someone reading just the claim should understand it without needing the full interaction
11. For Pipedrive deal updates: stage changes are Milestones, deal values are Context, expected close dates are Commitments
12. For emails: attribute facts to the sender of each message in the thread
```

### prompts/relationship-brief.md

```markdown
You are formatting a relationship intelligence brief for Brian.

Given structured data about a relationship (facts grouped by category, open tasks, recent interactions, alerts), create a concise, actionable brief.

FORMAT:
👤 [RELATIONSHIP NAME] — [Type] | Stage: [Stage]
Last interaction: [Date] ([N] days ago)
{If Pipedrive data: Deal: [deal name] — [stage] — $[value]}

🎯 ACTIVE COMMITMENTS
- [Commitment] — Due: [date] [⚠️ OVERDUE if past due] | Source: [interaction title, date]
- List commitments BY Brian and TO Brian separately

📋 OPEN TASKS ([count])
- [Task] — [Priority] | Due: [date]

💡 KEY CONTEXT & DECISIONS
- [Recent decisions, priorities, preferences, context facts]
- Source: [interaction title, date] for each

⚠️ CONCERNS & RISKS
- [Any concerns raised, with who raised them and when]
- Flag unresolved concerns

📈 RELATIONSHIP TRAJECTORY
- Brief assessment: interaction frequency trend, sentiment pattern, engagement level
- Flag if contact is going stale

Keep it scannable. Source-ground everything. Highlight anything overdue or urgent. No fluff.
```

### prompts/daily-briefing.md

```markdown
You are formatting Brian's daily intelligence briefing.

Given data about tasks, commitments, relationships, meetings, and deals, create a concise executive briefing.

FORMAT:
📋 TODAY'S PRIORITIES
- Top 5 tasks by priority with due dates and linked relationships

📅 MEETINGS
- Today's meetings with time, participants, and key context pulled from Facts DB
- For each meeting participant: show last relevant fact or commitment

⚠️ COMMITMENTS DUE
- Overdue commitments (by Brian to others AND by others to Brian) with relationship and source
- Commitments due this week

💰 DEAL UPDATES (from Pipedrive)
- Deals with expected close this week
- Deals that changed stage recently
- Deals at risk (stale or negative sentiment)

👥 RELATIONSHIPS NEEDING ATTENTION
- Active contacts with no interaction in 7+ days
- Relationships with unresolved concerns
- Contacts with overdue commitments

💡 SUGGESTED ACTIONS
- 2-3 proactive suggestions based on the intelligence data

Keep it brief. Brian is busy. Every claim cites its source. No fluff.
```

### prompts/deal-intelligence.md

```markdown
You are formatting a deal intelligence brief for Brian.

Given Pipedrive deal data combined with relationship facts from the EA intelligence system, create a comprehensive deal assessment.

FORMAT:
💰 [DEAL NAME] — [Stage] — $[Value]
Expected close: [Date] | Pipeline: [Pipeline name]
Owner: [Person] | Created: [Date]

👥 KEY STAKEHOLDERS
- For each participant: role, recent facts, concerns, commitments

📊 DEAL TIMELINE
- Stage progression with dates
- Key milestones and decisions

🎯 COMMITMENTS & NEXT STEPS
- What Brian committed to for this deal
- What the prospect committed to
- Upcoming deadlines

⚠️ RISKS & BLOCKERS
- Concerns raised by anyone involved
- Competitor mentions
- Stale activity (no recent interaction)
- Overdue commitments

📈 DEAL HEALTH ASSESSMENT
- Engagement level (based on interaction frequency)
- Sentiment trend (based on recent facts)
- Win probability assessment (based on signals)

Source-ground everything. Be direct about risks.
```

### prompts/meeting-recap.md

```markdown
Draft a concise, professional meeting recap message. This will be sent to attendees via Teams.

Given the meeting summary and extracted facts, create a recap that includes:

1. Brief summary (2-3 sentences)
2. Key decisions made (bullet points)
3. Action items with owners and due dates
4. Next steps

Tone: warm but business-focused. Keep it under 200 words. Don't include "Sent via Claude EA" — that's added automatically.
```

---

## Test Data

### test-data/sample-transcript-01.txt

Create a realistic 15-20 minute meeting transcript between Brian and Tony about the Sunstate Medical Transport AI automation project. Include:
- Discussion of pilot scope (3 facilities)
- Pricing discussion ($3,500/month mentioned)
- Start date commitment (March 15)
- Tony mentioning a competitor (Halo Health)
- Brian committing to deliver SOW by March 5
- Decision to use Retell for call-ahead system
- Tony's concern about patient data privacy
- Agreement on bi-weekly check-ins

Format as a VTT-style transcript with speaker labels and timestamps:
```
00:00:15 Brian: Hey Tony, thanks for jumping on...
00:00:22 Tony: Yeah absolutely, excited to walk through...
```

### test-data/sample-transcript-02.txt

Create a ManageAI founders sync transcript (Brian, Chad, Dave) discussing:
- Q2 expansion plans and $200K budget
- Pricing model concerns from Chad
- Dave's healthcare IT partnership idea
- Product roadmap priorities
- Robert's go-to-market timeline
- Decision to prioritize enterprise clients

### test-data/sample-email-01.txt

Create a realistic email thread (2-3 messages) between Brian and a Cornerstone contact about:
- Contract review status
- Security requirements for document storage
- Phase 1 go-live target of March 20
- Request for automated proposal generation feature

Format with standard email headers:
```
From: brian@manageai.io
To: mike@cornerstonegc.com
Date: February 24, 2026
Subject: Re: Contract Review — Phase 1

Mike,

Thanks for sending over the requirements...
```

### test-data/sample-pipedrive-deal.json

Create a sample Pipedrive deal object with associated activities:
```json
{
  "deal": {
    "id": 1234,
    "title": "Sunstate Medical Transport — AI Automation Pilot",
    "value": 3500,
    "currency": "USD",
    "stage_id": 3,
    "stage_name": "Proposal",
    "person_id": 5678,
    "person_name": "Tony",
    "org_id": 91011,
    "org_name": "Sunstate Medical Transport",
    "expected_close_date": "2026-03-15",
    "add_time": "2026-01-15",
    "update_time": "2026-02-28"
  },
  "activities": [
    {
      "id": 100,
      "type": "call",
      "subject": "Initial discovery call",
      "note": "Tony described their current manual call-ahead process...",
      "due_date": "2026-01-20",
      "person_id": 5678
    },
    {
      "id": 101,
      "type": "meeting",
      "subject": "Demo walkthrough",
      "note": "Walked through Retell AI call-ahead demo. Tony approved pilot for 3 facilities...",
      "due_date": "2026-02-28",
      "person_id": 5678
    }
  ],
  "stage_changes": [
    { "stage": "Qualified", "date": "2026-01-22" },
    { "stage": "Proposal", "date": "2026-02-20" }
  ]
}
```

---

## Build Sequence

Run scripts in this order:

```bash
# 1. Install dependencies
npm install

# 2. Create Notion databases (outputs database IDs)
node scripts/01-create-notion-databases.js

# 3. Update .env with the database IDs printed by Script 01

# 4. Seed test data
node scripts/02-seed-test-data.js

# 5. Test fact extraction quality (iterate on prompt if needed)
node scripts/03-test-fact-extraction.js

# 6. Test relationship intelligence queries
node scripts/04-test-relationship-query.js "Dave"
node scripts/04-test-relationship-query.js "Sunstate"
node scripts/04-test-relationship-query.js "Chad"

# 7. Test Graph API connectivity (requires Azure AD setup)
node scripts/05-test-graph-api.js

# 8. Test Pipedrive connectivity
node scripts/06-test-pipedrive-sync.js

# 9. Generate Make blueprints
node scripts/07-generate-make-blueprints.js

# 10. Import blueprints into Make.com (manual step)
# 11. Wire connections in Make (manual step)
# 12. Test end-to-end via Claude.ai
```

---

## Quality Checklist

Before considering any script complete:

- [ ] All Notion API calls include proper error handling with meaningful error messages
- [ ] All API responses are validated before processing
- [ ] Rate limiting: 350ms delay between sequential Notion API calls
- [ ] Deduplication: External IDs checked before creating Interactions
- [ ] JSON parsing: strip markdown code fences before JSON.parse
- [ ] Relations: verify target pages exist before creating relation links
- [ ] Dates: all dates in ISO 8601 format for Notion API
- [ ] Fact extraction: validate every fact has required fields before storing
- [ ] Rollups: test that Open Commitments and Interaction Count calculate correctly
- [ ] Make blueprints: all module IDs are unique within each scenario
- [ ] Make blueprints: designer positions are spaced properly (300px x-axis between modules)
- [ ] Pipedrive sync: handles pagination (Pipedrive API returns max 500 items per request)
- [ ] Pipedrive sync: maps person_id and org_id correctly to Notion Relationship records
- [ ] All scripts read credentials from .env via dotenv, never hardcoded
- [ ] output/ directory exists before writing files

---

## Coding Standards

- Use async/await throughout, no callbacks
- Use the official `@notionhq/client` SDK for Notion operations
- Use the official `@anthropic-ai/sdk` for Claude API calls
- Use `axios` for Microsoft Graph and Pipedrive API calls
- Every script should be runnable standalone: `node scripts/XX-name.js`
- Print clear progress messages: "Creating Relationships database... done (ID: abc123)"
- Print clear error messages with the API response body when calls fail
- Use `dotenv` to load .env at the top of every script
- All file paths relative to project root using `path.resolve(__dirname, '..')`
