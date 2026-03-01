#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const BLUEPRINTS_DIR = path.resolve(__dirname, "..", "blueprints");
const PROMPTS_DIR = path.resolve(__dirname, "..", "prompts");
const OUTPUT_DIR = path.resolve(__dirname, "..", "output", "blueprint-validation");
const DB_IDS_PATH = path.resolve(__dirname, "..", "output", "database-ids.json");

// Load database IDs
function loadDbIds() {
  if (fs.existsSync(DB_IDS_PATH)) {
    return JSON.parse(fs.readFileSync(DB_IDS_PATH, "utf8"));
  }
  return {
    relationships_db: process.env.NOTION_RELATIONSHIPS_DB || "REPLACE_WITH_DB_ID",
    facts_db: process.env.NOTION_FACTS_DB || "REPLACE_WITH_DB_ID",
    interactions_db: process.env.NOTION_INTERACTIONS_DB || "REPLACE_WITH_DB_ID",
    tasks_db: process.env.NOTION_TASKS_DB || "REPLACE_WITH_DB_ID",
    kb_db: process.env.NOTION_KB_DB || "REPLACE_WITH_DB_ID",
  };
}

// Load prompt file contents for embedding in blueprints
function loadPrompt(filename) {
  const fp = path.join(PROMPTS_DIR, filename);
  if (fs.existsSync(fp)) return fs.readFileSync(fp, "utf8");
  return `PLACEHOLDER: Load ${filename} prompt`;
}

// Module builder helper — positions modules 300px apart on x-axis
function mod(id, module, version, params, mapper, metadata, x) {
  return {
    id,
    module,
    version: version || 1,
    parameters: params || {},
    mapper: mapper || {},
    metadata: {
      designer: { x: x || id * 300, y: 0 },
      ...(metadata || {}),
    },
  };
}

function webhookTrigger(id) {
  return mod(id, "gateway:CustomWebHook", 1, {}, {
    ip: "",
    method: "POST",
    headers: [],
  });
}

function webhookResponse(id, body) {
  return mod(id, "gateway:WebhookResponse", 1, {}, {
    status: 200,
    body: body || "{{JSON.stringify($result)}}",
    headers: [{ key: "Content-Type", value: "application/json" }],
  }, {}, id * 300);
}

function scheduleTrigger(id, interval, time) {
  return mod(id, "builtin:BasicScheduler", 1, {
    scheduling: { type: "interval", interval: interval || 30 },
    time: time || "07:00",
  });
}

function notionQuery(id, dbId, filter, sorts) {
  return mod(id, "notion:searchObjects", 2, {
    database_id: dbId,
  }, {
    filter: filter || {},
    sorts: sorts || [],
  }, {}, id * 300);
}

function notionCreate(id, dbId, properties) {
  return mod(id, "notion:createAPage", 2, {
    database_id: dbId,
  }, {
    properties: properties || {},
  }, {}, id * 300);
}

function notionUpdate(id, pageId, properties) {
  return mod(id, "notion:updateAPage", 2, {}, {
    page_id: pageId || "{{item.id}}",
    properties: properties || {},
  }, {}, id * 300);
}

function httpRequest(id, url, method, body, headers) {
  return mod(id, "http:ActionSendData", 3, {}, {
    url: url || "",
    method: method || "GET",
    headers: headers || [{ name: "Content-Type", value: "application/json" }],
    body: body || "",
  }, {}, id * 300);
}

function claudeApi(id, systemPrompt, userContent, maxTokens, temperature) {
  return mod(id, "http:ActionSendData", 3, {}, {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: [
      { name: "Content-Type", value: "application/json" },
      { name: "x-api-key", value: "{{env.ANTHROPIC_API_KEY}}" },
      { name: "anthropic-version", value: "2023-06-01" },
    ],
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens || 8000,
      temperature: temperature || 0,
      system: systemPrompt || "{{system_prompt}}",
      messages: [{ role: "user", content: userContent || "{{content}}" }],
    }),
  }, {}, id * 300);
}

function iterator(id, arrayRef) {
  return mod(id, "builtin:BasicIterator", 1, {}, {
    array: arrayRef || "{{parseJSON(body).facts}}",
  }, {}, id * 300);
}

function router(id) {
  return mod(id, "builtin:BasicRouter", 1, {}, {}, {}, id * 300);
}

function jsonParse(id, textRef) {
  return mod(id, "json:ParseJSON", 1, {}, {
    text: textRef || "{{body.data[0].text}}",
  }, {}, id * 300);
}

function sleepModule(id, ms) {
  return mod(id, "builtin:BasicSleep", 1, {}, {
    delay: ms || 350,
  }, {}, id * 300);
}

function aggregate(id) {
  return mod(id, "builtin:BasicAggregator", 1, {}, {}, {}, id * 300);
}

function setVariable(id, name, value) {
  return mod(id, "util:SetVariable2", 1, {}, {
    name: name || "profile",
    value: value || "{{JSON.stringify($result)}}",
  }, {}, id * 300);
}

function blueprint(name, flow, instant) {
  return {
    name,
    flow,
    metadata: {
      instant: !!instant,
      version: 1,
      scenario: {
        roundtrips: 1,
        maxErrors: 3,
        autoCommit: true,
        autoCommitTriggerLast: true,
        sequential: false,
        confidential: false,
        dataloss: false,
        dlq: false,
      },
    },
  };
}

// ═══════ BLUEPRINT GENERATORS ═══════

function generateEA01(dbIds) {
  const prompt = loadPrompt("daily-briefing.md");
  return blueprint("EA-01 — Daily Intelligence Briefing", [
    webhookTrigger(1),
    notionQuery(2, dbIds.tasks_db, { property: "Status", status: { does_not_equal: "Done" } }, [{ property: "Priority", direction: "ascending" }]),
    notionQuery(3, dbIds.facts_db, { and: [{ property: "Category", select: { equals: "Commitment" } }, { property: "Status", select: { equals: "Active" } }] }),
    notionQuery(4, dbIds.relationships_db, { property: "Stage", select: { equals: "Active" } }),
    aggregate(5),
    claudeApi(6, prompt, "Format today's briefing from this data:\n\n{{JSON.stringify($result)}}", 4000, 0.3),
    webhookResponse(7, '{{body.content[0].text}}'),
  ], true);
}

function generateEA02(dbIds) {
  return blueprint("EA-02 — Teams Transcript Ingestion", [
    scheduleTrigger(1, 30, "07:00"),
    httpRequest(2, "https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=startDateTime ge {{formatDate(addMinutes(now; -30); 'YYYY-MM-DDTHH:mm:ssZ')}}&$top=50", "GET", null, [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
    ]),
    iterator(3, "{{body.value}}"),
    notionQuery(4, dbIds.interactions_db, { property: "External ID", rich_text: { equals: "{{item.id}}" } }),
    router(5),
    httpRequest(6, "https://graph.microsoft.com/v1.0/me/onlineMeetings/{{item.id}}/transcripts", "GET", null, [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
    ]),
    notionCreate(7, dbIds.interactions_db, {
      Title: { title: [{ text: { content: "{{item.subject}}" } }] },
      Type: { select: { name: "Meeting Transcript" } },
      Source: { select: { name: "Teams Transcription" } },
      Date: { date: { start: "{{item.startDateTime}}" } },
      "External ID": { rich_text: [{ text: { content: "{{item.id}}" } }] },
    }),
    httpRequest(8, "{{webhooks.EA03_URL}}", "POST", '{"interaction_id":"{{steps[7].id}}","type":"transcript"}'),
    sleepModule(9, 350),
  ], false);
}

function generateEA03(dbIds) {
  const prompt = loadPrompt("fact-extraction.md");
  return blueprint("EA-03 — Fact Extraction Pipeline", [
    webhookTrigger(1),
    router(2),
    notionQuery(3, dbIds.interactions_db, { property: "Title", title: { is_not_empty: true } }),
    claudeApi(4, prompt, "Process this {{trigger.type}}:\n\n{{ifempty(trigger.raw_content; steps[3].rawContent)}}", 8000, 0),
    jsonParse(5, "{{body.content[0].text}}"),
    iterator(6, "{{steps[5].facts}}"),
    notionQuery(7, dbIds.relationships_db, { property: "Name", title: { contains: "{{item.relationship}}" } }),
    notionCreate(8, dbIds.facts_db, {
      Fact: { title: [{ text: { content: "{{item.claim}}" } }] },
      Category: { select: { name: "{{item.category}}" } },
      Speaker: { rich_text: [{ text: { content: "{{item.speaker}}" } }] },
      "Source Timestamp": { rich_text: [{ text: { content: "{{item.timestamp}}" } }] },
      Confidence: { select: { name: "{{item.confidence}}" } },
      Sentiment: { select: { name: "{{item.sentiment}}" } },
      Status: { select: { name: "Active" } },
      "Extracted Date": { date: { start: "{{formatDate(now; 'YYYY-MM-DD')}}" } },
      Relationship: { relation: [{ id: "{{steps[7][0].id}}" }] },
      "Source Interaction": { relation: [{ id: "{{trigger.interaction_id}}" }] },
    }),
    router(9),
    iterator(10, "{{steps[5].action_items}}"),
    notionCreate(11, dbIds.tasks_db, {
      Name: { title: [{ text: { content: "{{item.title}}" } }] },
      Priority: { select: { name: "{{item.priority}}" } },
      "Created By": { select: { name: "Fact Extraction" } },
    }),
    notionUpdate(12, "{{trigger.interaction_id}}", {
      Processed: { checkbox: true },
      Summary: { rich_text: [{ text: { content: "{{steps[5].summary}}" } }] },
      "Facts Extracted": { number: "{{length(steps[5].facts)}}" },
    }),
    webhookResponse(13, '{"success":true,"facts_extracted":{{length(steps[5].facts)}},"tasks_created":{{length(steps[5].action_items)}},"summary":"{{steps[5].summary}}"}'),
  ], true);
}

function generateEA04(dbIds) {
  return blueprint("EA-04 — Outlook Email Ingestion", [
    scheduleTrigger(1, 15, "07:00"),
    httpRequest(2, "https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge {{formatDate(addMinutes(now; -15); 'YYYY-MM-DDTHH:mm:ssZ')}}&$select=subject,from,toRecipients,body,receivedDateTime&$top=50", "GET", null, [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
    ]),
    iterator(3, "{{body.value}}"),
    notionQuery(4, dbIds.interactions_db, { property: "External ID", rich_text: { equals: "{{item.id}}" } }),
    router(5),
    notionCreate(6, dbIds.interactions_db, {
      Title: { title: [{ text: { content: "{{item.subject}}" } }] },
      Type: { select: { name: "Email" } },
      Source: { select: { name: "Outlook" } },
      Date: { date: { start: "{{item.receivedDateTime}}" } },
      "External ID": { rich_text: [{ text: { content: "{{item.id}}" } }] },
      "Raw Content": { rich_text: [{ text: { content: "{{item.body.content}}" } }] },
    }),
    httpRequest(7, "{{webhooks.EA03_URL}}", "POST", '{"interaction_id":"{{steps[6].id}}","type":"email","raw_content":"{{item.body.content}}"}'),
    sleepModule(8, 350),
  ], false);
}

function generateEA05(dbIds) {
  const prompt = loadPrompt("relationship-brief.md");
  return blueprint("EA-05 — Relationship Intelligence Query", [
    webhookTrigger(1),
    notionQuery(2, dbIds.relationships_db, { property: "Name", title: { contains: "{{trigger.query}}" } }),
    notionQuery(3, dbIds.facts_db, { property: "Relationship", relation: { contains: "{{steps[2][0].id}}" } }, [{ property: "Extracted Date", direction: "descending" }]),
    notionQuery(4, dbIds.tasks_db, { property: "Relationship", relation: { contains: "{{steps[2][0].id}}" } }),
    notionQuery(5, dbIds.interactions_db, { property: "Relationships", relation: { contains: "{{steps[2][0].id}}" } }, [{ property: "Date", direction: "descending" }]),
    setVariable(6, "profile", '{"relationship":{{JSON.stringify(steps[2][0])}},"facts":{{JSON.stringify(steps[3])}},"tasks":{{JSON.stringify(steps[4])}},"interactions":{{JSON.stringify(steps[5])}}}'),
    claudeApi(7, prompt, "Format an intelligence brief from this data:\n\n{{variables.profile}}", 4000, 0.3),
    webhookResponse(8, '{{body.content[0].text}}'),
  ], true);
}

function generateEA06(dbIds) {
  return blueprint("EA-06 — Commitment Tracker", [
    webhookTrigger(1),
    notionQuery(2, dbIds.facts_db, {
      and: [
        { property: "Category", select: { equals: "Commitment" } },
        { property: "Status", select: { equals: "Active" } },
      ],
    }, [{ property: "Due Date", direction: "ascending" }]),
    router(3),
    aggregate(4),
    webhookResponse(5, '{{JSON.stringify($result)}}'),
  ], true);
}

function generateEA07(dbIds) {
  return blueprint("EA-07 — Task Manager", [
    webhookTrigger(1),
    router(2),
    // Create route
    notionCreate(3, dbIds.tasks_db, {
      Name: { title: [{ text: { content: "{{trigger.task.name}}" } }] },
      Priority: { select: { name: "{{trigger.task.priority}}" } },
      Project: { select: { name: "{{trigger.task.project}}" } },
      "Due Date": { date: { start: "{{trigger.task.due_date}}" } },
      Notes: { rich_text: [{ text: { content: "{{trigger.task.notes}}" } }] },
    }),
    // Update route
    notionUpdate(4, "{{trigger.task_id}}", {
      Name: { title: [{ text: { content: "{{trigger.task.name}}" } }] },
    }),
    // Delete (archive) route
    notionUpdate(5, "{{trigger.task_id}}", { archived: true }),
    // List route
    notionQuery(6, dbIds.tasks_db, {}),
    // Search route
    notionQuery(7, dbIds.tasks_db, { property: "Name", title: { contains: "{{trigger.query}}" } }),
    webhookResponse(8, '{{JSON.stringify($result)}}'),
  ], true);
}

function generateEA08(dbIds) {
  return blueprint("EA-08 — Knowledge Base Operations", [
    webhookTrigger(1),
    router(2),
    // Search route
    notionQuery(3, dbIds.kb_db, { property: "Title", title: { contains: "{{trigger.query}}" } }),
    // Create route
    notionCreate(4, dbIds.kb_db, {
      Title: { title: [{ text: { content: "{{trigger.content.title}}" } }] },
      Category: { select: { name: "{{trigger.content.category}}" } },
      "Created By": { select: { name: "Claude EA" } },
    }),
    webhookResponse(5, '{{JSON.stringify($result)}}'),
  ], true);
}

function generateEA09(dbIds) {
  return blueprint("EA-09 — Teams Messenger", [
    webhookTrigger(1),
    router(2),
    // Send DM route
    httpRequest(3, "https://graph.microsoft.com/v1.0/chats", "POST", '{"chatType":"oneOnOne","members":[{"@odata.type":"#microsoft.graph.aadUserConversationMember","roles":["owner"],"user@odata.bind":"https://graph.microsoft.com/v1.0/users(\'{{trigger.to}}\')"}]}', [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
      { name: "Content-Type", value: "application/json" },
    ]),
    httpRequest(4, "https://graph.microsoft.com/v1.0/chats/{{steps[3].id}}/messages", "POST", '{"body":{"contentType":"html","content":"{{trigger.message}}<br><br><em>Sent via Claude EA</em>"}}', [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
      { name: "Content-Type", value: "application/json" },
    ]),
    // Send channel route
    httpRequest(5, "https://graph.microsoft.com/v1.0/teams/{{trigger.team_id}}/channels/{{trigger.to}}/messages", "POST", '{"body":{"contentType":"html","content":"{{trigger.message}}<br><br><em>Sent via Claude EA</em>"}}', [
      { name: "Authorization", value: "Bearer {{connection.token}}" },
      { name: "Content-Type", value: "application/json" },
    ]),
    // Log interaction
    notionCreate(6, dbIds.interactions_db, {
      Title: { title: [{ text: { content: "Teams message to {{trigger.to}}" } }] },
      Type: { select: { name: "Teams Chat" } },
      Source: { select: { name: "Teams Chat" } },
      Date: { date: { start: "{{formatDate(now; 'YYYY-MM-DD')}}" } },
    }),
    webhookResponse(7, '{"success":true,"message":"sent"}'),
  ], true);
}

function generateEA10(dbIds) {
  const prompt = loadPrompt("meeting-recap.md");
  return blueprint("EA-10 — Meeting Follow-Up Pipeline", [
    webhookTrigger(1),
    notionQuery(2, dbIds.interactions_db, { property: "Title", title: { is_not_empty: true } }),
    router(3),
    httpRequest(4, "{{webhooks.EA03_URL}}", "POST", '{"interaction_id":"{{trigger.meeting_id}}","type":"transcript"}'),
    notionQuery(5, dbIds.facts_db, { property: "Source Interaction", relation: { contains: "{{trigger.meeting_id}}" } }),
    iterator(6, "{{steps[5]}}"),
    httpRequest(7, "{{webhooks.EA07_URL}}", "POST", '{"action":"create","task":{"name":"{{item.claim}}","priority":"P2"}}'),
    claudeApi(8, prompt, "Draft a meeting recap:\n\n{{JSON.stringify(steps[5])}}", 2000, 0.3),
    iterator(9, "{{trigger.attendees}}"),
    httpRequest(10, "{{webhooks.EA09_URL}}", "POST", '{"action":"send_dm","to":"{{item}}","message":"{{steps[8].content[0].text}}"}'),
    webhookResponse(11, '{"success":true}'),
  ], true);
}

function generateEA11(dbIds) {
  return blueprint("EA-11 — Relationship CRUD", [
    webhookTrigger(1),
    router(2),
    // Create route
    notionCreate(3, dbIds.relationships_db, {
      Name: { title: [{ text: { content: "{{trigger.relationship.name}}" } }] },
      Type: { select: { name: "{{trigger.relationship.type}}" } },
      Company: { rich_text: [{ text: { content: "{{trigger.relationship.company}}" } }] },
      Email: { email: "{{trigger.relationship.email}}" },
      Stage: { select: { name: "{{trigger.relationship.stage}}" } },
    }),
    // Update route
    notionUpdate(4, "{{trigger.relationship_id}}"),
    // Lookup route
    notionQuery(5, dbIds.relationships_db, {
      or: [
        { property: "Name", title: { contains: "{{trigger.relationship.name}}" } },
        { property: "Email", email: { equals: "{{trigger.relationship.email}}" } },
      ],
    }),
    // List stale route
    notionQuery(6, dbIds.relationships_db, {
      and: [
        { property: "Stage", select: { equals: "Active" } },
        { property: "Last Interaction", date: { before: "{{formatDate(addDays(now; -7); 'YYYY-MM-DD')}}" } },
      ],
    }),
    webhookResponse(7, '{{JSON.stringify($result)}}'),
  ], true);
}

function generateEA12(dbIds) {
  return blueprint("EA-12 — Pipedrive Sync", [
    scheduleTrigger(1, 60),
    httpRequest(2, "https://{{env.PIPEDRIVE_DOMAIN}}.pipedrive.com/api/v1/recents?since_timestamp={{datastore.last_sync}}&items=person,organization,deal,activity,note&api_token={{env.PIPEDRIVE_API_TOKEN}}", "GET"),
    router(3),
    // Persons route
    iterator(4, "{{filterArray(steps[2].data; 'item'; 'person')}}"),
    notionQuery(5, dbIds.relationships_db, { property: "Pipedrive Person ID", number: { equals: "{{item.data.id}}" } }),
    router(6),
    notionCreate(7, dbIds.relationships_db, {
      Name: { title: [{ text: { content: "{{item.data.name}}" } }] },
      Type: { select: { name: "Person" } },
      Email: { email: "{{item.data.email[0].value}}" },
      "Pipedrive Person ID": { number: "{{item.data.id}}" },
      Stage: { select: { name: "Active" } },
    }),
    notionUpdate(8, "{{steps[5][0].id}}", {
      Email: { email: "{{item.data.email[0].value}}" },
      "Last Interaction": { date: { start: "{{formatDate(now; 'YYYY-MM-DD')}}" } },
    }),
    // Activities route
    iterator(9, "{{filterArray(steps[2].data; 'item'; 'activity')}}"),
    notionCreate(10, dbIds.interactions_db, {
      Title: { title: [{ text: { content: "{{item.data.subject}}" } }] },
      Type: { select: { name: "Pipedrive Activity" } },
      Source: { select: { name: "Pipedrive" } },
      Date: { date: { start: "{{item.data.due_date}}" } },
      "Raw Content": { rich_text: [{ text: { content: "{{item.data.note}}" } }] },
    }),
    httpRequest(11, "{{webhooks.EA03_URL}}", "POST", '{"interaction_id":"{{steps[10].id}}","type":"pipedrive_activity","raw_content":"{{item.data.note}}"}'),
    // Deals route
    iterator(12, "{{filterArray(steps[2].data; 'item'; 'deal')}}"),
    notionCreate(13, dbIds.interactions_db, {
      Title: { title: [{ text: { content: "Deal update: {{item.data.title}}" } }] },
      Type: { select: { name: "Pipedrive Deal Update" } },
      Source: { select: { name: "Pipedrive" } },
    }),
    httpRequest(14, "{{webhooks.EA03_URL}}", "POST", '{"interaction_id":"{{steps[13].id}}","type":"pipedrive_deal","raw_content":"{{JSON.stringify(item.data)}}"}'),
    // Store last sync timestamp
    setVariable(15, "last_sync", "{{formatDate(now; 'YYYY-MM-DDTHH:mm:ssZ')}}"),
    webhookResponse(16, '{"synced":{"items":{{length(steps[2].data)}}}}'),
  ], false);
}

function generateEA13(dbIds) {
  const prompt = loadPrompt("deal-intelligence.md");
  return blueprint("EA-13 — Deal Intelligence", [
    webhookTrigger(1),
    httpRequest(2, "https://{{env.PIPEDRIVE_DOMAIN}}.pipedrive.com/api/v1/deals/search?term={{trigger.query}}&api_token={{env.PIPEDRIVE_API_TOKEN}}", "GET"),
    httpRequest(3, "https://{{env.PIPEDRIVE_DOMAIN}}.pipedrive.com/api/v1/deals/{{steps[2].data.items[0].item.id}}?api_token={{env.PIPEDRIVE_API_TOKEN}}", "GET"),
    httpRequest(4, "https://{{env.PIPEDRIVE_DOMAIN}}.pipedrive.com/api/v1/deals/{{steps[2].data.items[0].item.id}}/flow?api_token={{env.PIPEDRIVE_API_TOKEN}}", "GET"),
    httpRequest(5, "https://{{env.PIPEDRIVE_DOMAIN}}.pipedrive.com/api/v1/deals/{{steps[2].data.items[0].item.id}}/participants?api_token={{env.PIPEDRIVE_API_TOKEN}}", "GET"),
    notionQuery(6, dbIds.facts_db, { property: "Relationship", relation: { is_not_empty: true } }),
    notionQuery(7, dbIds.tasks_db, {}),
    setVariable(8, "deal_profile", '{"deal":{{JSON.stringify(steps[3].data)}},"timeline":{{JSON.stringify(steps[4].data)}},"participants":{{JSON.stringify(steps[5].data)}},"facts":{{JSON.stringify(steps[6])}},"tasks":{{JSON.stringify(steps[7])}}}'),
    claudeApi(9, prompt, "Format a deal intelligence brief:\n\n{{variables.deal_profile}}", 4000, 0.3),
    webhookResponse(10, '{{body.content[0].text}}'),
  ], true);
}

// ═══════ MAIN ═══════

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 07: Generate Make Blueprints");
  console.log("═══════════════════════════════════════════════════\n");

  const dbIds = loadDbIds();

  // Ensure directories exist
  for (const dir of [BLUEPRINTS_DIR, OUTPUT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const generators = [
    { name: "EA-01-daily-intelligence-briefing", fn: () => generateEA01(dbIds) },
    { name: "EA-02-teams-transcript-ingestion", fn: () => generateEA02(dbIds) },
    { name: "EA-03-fact-extraction-pipeline", fn: () => generateEA03(dbIds) },
    { name: "EA-04-outlook-email-ingestion", fn: () => generateEA04(dbIds) },
    { name: "EA-05-relationship-intelligence-query", fn: () => generateEA05(dbIds) },
    { name: "EA-06-commitment-tracker", fn: () => generateEA06(dbIds) },
    { name: "EA-07-task-manager", fn: () => generateEA07(dbIds) },
    { name: "EA-08-knowledge-base-ops", fn: () => generateEA08(dbIds) },
    { name: "EA-09-teams-messenger", fn: () => generateEA09(dbIds) },
    { name: "EA-10-meeting-follow-up-pipeline", fn: () => generateEA10(dbIds) },
    { name: "EA-11-relationship-crud", fn: () => generateEA11(dbIds) },
    { name: "EA-12-pipedrive-sync", fn: () => generateEA12(dbIds) },
    { name: "EA-13-deal-intelligence", fn: () => generateEA13(dbIds) },
  ];

  const validationResults = [];

  for (const gen of generators) {
    console.log(`Generating ${gen.name}...`);

    const bp = gen.fn();
    const filePath = path.join(BLUEPRINTS_DIR, `${gen.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(bp, null, 2));

    // Validate
    const errors = [];
    const moduleIds = bp.flow.map((m) => m.id);
    const uniqueIds = new Set(moduleIds);
    if (uniqueIds.size !== moduleIds.length) {
      errors.push("Duplicate module IDs found");
    }

    // Check module positions
    for (let i = 1; i < bp.flow.length; i++) {
      const prevX = bp.flow[i - 1].metadata?.designer?.x || 0;
      const currX = bp.flow[i].metadata?.designer?.x || 0;
      if (currX <= prevX && i > 0) {
        // Allow routers and parallel paths to overlap
      }
    }

    if (errors.length === 0) {
      console.log(`  ✓ ${gen.name} (${bp.flow.length} modules)`);
    } else {
      console.log(`  ⚠️ ${gen.name} — validation warnings: ${errors.join(", ")}`);
    }

    validationResults.push({ name: gen.name, modules: bp.flow.length, errors });
  }

  // Save validation report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "validation-report.json"),
    JSON.stringify(validationResults, null, 2)
  );

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✓ ALL 13 BLUEPRINTS GENERATED");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Output directory: ${BLUEPRINTS_DIR}`);
  console.log(`  Validation report: ${path.join(OUTPUT_DIR, "validation-report.json")}`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Import each JSON into Make.com (Scenarios → Import Blueprint)");
  console.log("  2. Wire connections (Notion, Graph, Pipedrive) in each scenario");
  console.log("  3. Set webhook URLs in scenarios that chain to EA-03");
  console.log("  4. Test end-to-end via Claude.ai with Make MCP connector");
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
