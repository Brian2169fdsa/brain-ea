#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  createPage,
  queryDatabase,
  titleProp,
  richText,
  selectProp,
  multiSelectProp,
  dateProp,
  numberProp,
  relationProp,
  checkboxProp,
  statusProp,
  emailProp,
  phoneProp,
  extractTitle,
} = require("./utils/notion-client");

const DB_IDS_PATH = path.resolve(__dirname, "..", "output", "database-ids.json");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 02: Seed Test Data");
  console.log("═══════════════════════════════════════════════════\n");

  // Load database IDs
  let dbIds;
  if (fs.existsSync(DB_IDS_PATH)) {
    dbIds = JSON.parse(fs.readFileSync(DB_IDS_PATH, "utf8"));
  } else {
    dbIds = {
      relationships_db: process.env.NOTION_RELATIONSHIPS_DB,
      facts_db: process.env.NOTION_FACTS_DB,
      interactions_db: process.env.NOTION_INTERACTIONS_DB,
      tasks_db: process.env.NOTION_TASKS_DB,
      kb_db: process.env.NOTION_KB_DB,
    };
  }

  const { relationships_db, facts_db, interactions_db, tasks_db } = dbIds;

  if (!relationships_db || !facts_db || !interactions_db || !tasks_db) {
    console.error("ERROR: Database IDs not found. Run Script 01 first, or set them in .env");
    process.exit(1);
  }

  // ─── RELATIONSHIPS ───────────────────────────────────────
  console.log("Creating Relationships...\n");

  const relMap = {};

  const relationships = [
    { name: "Dave", type: "Person", company: "ManageAI", stage: "Active", tags: ["ManageAI"], email: "dave@manageai.io" },
    { name: "Chad", type: "Person", company: "ManageAI", stage: "Active", tags: ["ManageAI"], email: "chad@manageai.io" },
    { name: "Tony", type: "Person", company: "Sunstate Medical Transport", stage: "Engaged", tags: ["Client"], email: "tony@sunstatetransport.com" },
    { name: "Jacob", type: "Person", company: "ManageAI", stage: "Active", tags: ["ManageAI"], email: "jacob@manageai.io" },
    { name: "Robert", type: "Person", company: "ManageAI", stage: "Active", tags: ["ManageAI"], email: "robert@manageai.io" },
    { name: "Pat", type: "Person", company: "ManageAI", stage: "Active", tags: ["ManageAI"], email: "pat@manageai.io" },
    { name: "Sunstate Medical Transport", type: "Company", company: "", stage: "Engaged", tags: ["Client"] },
    { name: "Cornerstone General Contractors", type: "Company", company: "", stage: "Active", tags: ["Client"] },
  ];

  for (const r of relationships) {
    const page = await createPage(relationships_db, {
      Name: titleProp(r.name),
      Type: selectProp(r.type),
      Company: richText(r.company),
      Stage: selectProp(r.stage),
      Tags: multiSelectProp(r.tags),
      ...(r.email ? { Email: emailProp(r.email) } : {}),
      "Last Interaction": dateProp("2026-02-28"),
      Owner: richText("Brian"),
    });
    relMap[r.name] = page.id;
    console.log(`  ✓ ${r.name} (${page.id})`);
  }

  // ─── INTERACTIONS ────────────────────────────────────────
  console.log("\nCreating Interactions...\n");

  const intMap = {};

  const interactions = [
    {
      title: "Sunstate Demo Walkthrough",
      type: "Meeting Transcript",
      date: "2026-02-28",
      source: "Teams Transcription",
      participants: ["Brian", "Tony"],
      relationships: ["Tony", "Sunstate Medical Transport"],
      summary: "Demo walkthrough of Retell AI call-ahead system for Sunstate Medical Transport. Discussed pilot scope covering Phoenix, Scottsdale, and Mesa facilities. Tony approved Retell integration and committed to March 15 start date.",
      processed: true,
      factsExtracted: 5,
    },
    {
      title: "ManageAI Founders Sync",
      type: "Meeting Transcript",
      date: "2026-02-25",
      source: "Teams Transcription",
      participants: ["Brian", "Chad", "Dave"],
      relationships: ["Chad", "Dave"],
      summary: "Founders sync covering Q2 expansion plans, $200K budget, pricing model concerns, and decision to prioritize enterprise clients. Chad committed to finalizing product roadmap by March 10.",
      processed: true,
      factsExtracted: 8,
    },
    {
      title: "Cornerstone Contract Review",
      type: "Email",
      date: "2026-02-24",
      source: "Outlook",
      participants: ["Brian", "Cornerstone"],
      relationships: ["Cornerstone General Contractors"],
      summary: "Email exchange about Phase 1 contract review, security requirements for document storage, and go-live target of March 20.",
      processed: true,
      factsExtracted: 5,
    },
    {
      title: "Expansion Planning Discussion",
      type: "Meeting Transcript",
      date: "2026-02-20",
      source: "Teams Transcription",
      participants: ["Brian", "Dave"],
      relationships: ["Dave"],
      summary: "Discussion about ManageAI expansion plans, healthcare IT partnership opportunities, and hiring timeline concerns for Q2.",
      processed: true,
      factsExtracted: 4,
    },
    {
      title: "Sunstate Pricing Follow-up",
      type: "Email",
      date: "2026-02-26",
      source: "Outlook",
      participants: ["Brian", "Tony"],
      relationships: ["Tony", "Sunstate Medical Transport"],
      summary: "Follow-up email on pricing details for the Sunstate pilot. Tony wants pricing finalized by March 7. Budget confirmed at $3,500/month.",
      processed: true,
      factsExtracted: 3,
    },
  ];

  for (const i of interactions) {
    const relIds = i.relationships.map((name) => relMap[name]).filter(Boolean);
    const page = await createPage(interactions_db, {
      Title: titleProp(i.title),
      Type: selectProp(i.type),
      Date: dateProp(i.date),
      Source: selectProp(i.source),
      Participants: multiSelectProp(i.participants),
      Relationships: relationProp(relIds),
      Summary: richText(i.summary),
      Processed: checkboxProp(i.processed),
      "Facts Extracted": numberProp(i.factsExtracted),
    });
    intMap[i.title] = page.id;
    console.log(`  ✓ ${i.title} (${page.id})`);
  }

  // ─── FACTS ───────────────────────────────────────────────
  console.log("\nCreating Facts...\n");

  const facts = [
    // Sunstate/Tony facts
    { claim: "Pilot will cover Phoenix, Scottsdale, and Mesa facilities", category: "Decision", rel: "Tony", speaker: "Tony", confidence: "High", sentiment: "Positive", source: "Sunstate Demo Walkthrough", tags: ["product", "timeline"] },
    { claim: "Start date March 15 for pilot", category: "Commitment", rel: "Tony", speaker: "Tony", confidence: "High", sentiment: "Positive", dueDate: "2026-03-15", source: "Sunstate Demo Walkthrough", tags: ["timeline"] },
    { claim: "Approved Retell integration for call-ahead system", category: "Decision", rel: "Tony", speaker: "Tony", confidence: "High", sentiment: "Positive", source: "Sunstate Demo Walkthrough", tags: ["product", "technical"] },
    { claim: "Wants pricing finalized by March 7", category: "Request", rel: "Tony", speaker: "Tony", confidence: "High", sentiment: "Neutral", dueDate: "2026-03-07", source: "Sunstate Pricing Follow-up", tags: ["pricing", "timeline"] },
    { claim: "Budget is $3,500/month for the pilot", category: "Context", rel: "Tony", speaker: "Tony", confidence: "High", sentiment: "Neutral", source: "Sunstate Pricing Follow-up", tags: ["pricing", "budget"] },

    // Dave facts
    { claim: "Budget for Q2 expansion is $200K", category: "Context", rel: "Dave", speaker: "Dave", confidence: "High", sentiment: "Neutral", source: "ManageAI Founders Sync", tags: ["budget"] },
    { claim: "Interested in healthcare IT partnership", category: "Priority", rel: "Dave", speaker: "Dave", confidence: "High", sentiment: "Positive", source: "Expansion Planning Discussion", tags: ["partnership"] },
    { claim: "Wants capabilities deck by end of February", category: "Commitment", rel: "Dave", speaker: "Brian", confidence: "Medium", sentiment: "Neutral", dueDate: "2026-02-28", status: "Active", source: "Expansion Planning Discussion", tags: ["timeline"] },
    { claim: "Prefers Monday morning calls", category: "Preference", rel: "Dave", speaker: "Dave", confidence: "Medium", sentiment: "Neutral", source: "Expansion Planning Discussion", tags: [] },
    { claim: "Concerned about hiring timeline for Q2", category: "Concern", rel: "Dave", speaker: "Dave", confidence: "High", sentiment: "Negative", source: "ManageAI Founders Sync", tags: ["hiring"] },

    // Chad facts
    { claim: "Concerned about pricing model sustainability", category: "Concern", rel: "Chad", speaker: "Chad", confidence: "High", sentiment: "Negative", source: "ManageAI Founders Sync", tags: ["pricing"] },
    { claim: "Wants to prioritize enterprise clients for Q2", category: "Priority", rel: "Chad", speaker: "Chad", confidence: "High", sentiment: "Neutral", source: "ManageAI Founders Sync", tags: ["product"] },
    { claim: "Approved ManageAI rebrand concept", category: "Decision", rel: "Chad", speaker: "Chad", confidence: "High", sentiment: "Positive", source: "ManageAI Founders Sync", tags: ["product"] },
    { claim: "Committed to finalizing product roadmap by March 10", category: "Commitment", rel: "Chad", speaker: "Chad", confidence: "High", sentiment: "Neutral", dueDate: "2026-03-10", source: "ManageAI Founders Sync", tags: ["product", "timeline"] },

    // Cornerstone facts
    { claim: "Contract value is $8,500/month", category: "Context", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "High", sentiment: "Neutral", source: "Cornerstone Contract Review", tags: ["pricing", "budget"] },
    { claim: "Wants automated proposal generation", category: "Priority", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "High", sentiment: "Positive", source: "Cornerstone Contract Review", tags: ["product"] },
    { claim: "Concerned about data security for contract storage", category: "Concern", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "Medium", sentiment: "Negative", source: "Cornerstone Contract Review", tags: ["technical", "legal"] },
    { claim: "Approved Phase 1 SOW", category: "Decision", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "High", sentiment: "Positive", source: "Cornerstone Contract Review", tags: ["legal"] },
    { claim: "Go-live target is March 20", category: "Commitment", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "Medium", sentiment: "Neutral", dueDate: "2026-03-20", source: "Cornerstone Contract Review", tags: ["timeline"] },

    // Cross-cutting facts
    { claim: "ManageAI should support Zapier in addition to Make and n8n", category: "Feedback", rel: "Dave", speaker: "Dave", confidence: "Medium", sentiment: "Neutral", source: "Expansion Planning Discussion", tags: ["product", "technical"] },
    { claim: "Jacob completed the Make builder refactor", category: "Milestone", rel: "Jacob", speaker: "Jacob", confidence: "High", sentiment: "Positive", source: "ManageAI Founders Sync", tags: ["technical"] },
    { claim: "Robert's go-to-market plan deliverable is due March 1", category: "Commitment", rel: "Robert", speaker: "Robert", confidence: "High", sentiment: "Neutral", dueDate: "2026-03-01", source: "ManageAI Founders Sync", tags: ["timeline"] },
    { claim: "Pat suggested adding consumer app patterns to client demos", category: "Feedback", rel: "Pat", speaker: "Pat", confidence: "Medium", sentiment: "Positive", source: "ManageAI Founders Sync", tags: ["product"] },
    { claim: "Tony mentioned competitor Halo Health is also pitching Sunstate", category: "Context", rel: "Tony", speaker: "Tony", confidence: "Medium", sentiment: "Negative", source: "Sunstate Demo Walkthrough", tags: ["product"] },
    { claim: "Cornerstone wants bi-weekly status calls", category: "Preference", rel: "Cornerstone General Contractors", speaker: "Cornerstone", confidence: "High", sentiment: "Neutral", source: "Cornerstone Contract Review", tags: [] },
    { claim: "Dave recommended reaching out to Phoenix Health Systems", category: "Request", rel: "Dave", speaker: "Dave", confidence: "Medium", sentiment: "Positive", source: "Expansion Planning Discussion", tags: ["partnership"] },
  ];

  for (const f of facts) {
    const relId = relMap[f.rel];
    const intId = intMap[f.source];

    const properties = {
      Fact: titleProp(f.claim),
      Category: selectProp(f.category),
      Speaker: richText(f.speaker),
      "Source Timestamp": richText("meeting"),
      Confidence: selectProp(f.confidence),
      Status: selectProp(f.status || "Active"),
      Sentiment: selectProp(f.sentiment),
      "Extracted Date": dateProp("2026-02-28"),
      Tags: multiSelectProp(f.tags.length > 0 ? f.tags : []),
    };

    if (f.dueDate) properties["Due Date"] = dateProp(f.dueDate);
    if (relId) properties["Relationship"] = relationProp([relId]);
    if (intId) properties["Source Interaction"] = relationProp([intId]);

    await createPage(facts_db, properties);
    console.log(`  ✓ [${f.category}] ${f.claim.substring(0, 60)}...`);
  }

  // ─── TASKS ───────────────────────────────────────────────
  console.log("\nCreating Tasks...\n");

  const tasks = [
    { name: "Finalize Sunstate pilot pricing", status: "To Do", priority: "P1 (High)", dueDate: "2026-03-07", project: "ManageAI", rel: "Sunstate Medical Transport", source: "Sunstate Demo Walkthrough", assignedTo: "Brian", createdBy: "Fact Extraction" },
    { name: "Set up 3 facility Retell agents", status: "To Do", priority: "P2 (Medium)", dueDate: "2026-03-12", project: "ManageAI", rel: "Sunstate Medical Transport", assignedTo: "Jacob", createdBy: "Fact Extraction" },
    { name: "Draft Sunstate SOW for Tony's review", status: "To Do", priority: "P1 (High)", dueDate: "2026-03-05", project: "ManageAI", rel: "Sunstate Medical Transport", assignedTo: "Brian", createdBy: "Fact Extraction" },
    { name: "Send Dave capabilities deck", status: "To Do", priority: "P1 (High)", dueDate: "2026-02-28", project: "ManageAI", rel: "Dave", assignedTo: "Brian", createdBy: "Fact Extraction" },
    { name: "Review Cornerstone contract security requirements", status: "To Do", priority: "P2 (Medium)", dueDate: "2026-03-10", project: "ManageAI", rel: "Cornerstone General Contractors", assignedTo: "Brian", createdBy: "Fact Extraction" },
    { name: "Update ManageAI pricing page", status: "To Do", priority: "P3 (Low)", dueDate: null, project: "ManageAI", assignedTo: "Brian", createdBy: "Manual" },
    { name: "Approve Jacob's Make builder PR", status: "To Do", priority: "P2 (Medium)", dueDate: "2026-03-03", project: "ManageAI", rel: "Jacob", assignedTo: "Brian", createdBy: "Manual" },
    { name: "Prepare ABCAC certification demo", status: "To Do", priority: "P2 (Medium)", dueDate: "2026-03-08", project: "ManageAI", assignedTo: "Brian", createdBy: "Manual" },
    { name: "Follow up with Robert on GTM deliverable", status: "In Progress", priority: "P1 (High)", dueDate: "2026-03-01", project: "ManageAI", rel: "Robert", assignedTo: "Brian", createdBy: "Fact Extraction" },
    { name: "Research Phoenix Health Systems per Dave's rec", status: "To Do", priority: "P3 (Low)", dueDate: null, project: "ManageAI", rel: "Dave", assignedTo: "Brian", createdBy: "Fact Extraction" },
  ];

  for (const t of tasks) {
    const properties = {
      Name: titleProp(t.name),
      Status: statusProp(t.status || "To Do"),
      Priority: selectProp(t.priority),
      Project: selectProp(t.project),
      "Assigned To": richText(t.assignedTo || "Brian"),
      "Created By": selectProp(t.createdBy),
    };

    if (t.dueDate) properties["Due Date"] = dateProp(t.dueDate);
    if (t.rel && relMap[t.rel]) properties["Relationship"] = relationProp([relMap[t.rel]]);
    if (t.source && intMap[t.source]) properties["Source Interaction"] = relationProp([intMap[t.source]]);

    await createPage(tasks_db, properties);
    console.log(`  ✓ ${t.name}`);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✓ ALL TEST DATA SEEDED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Relationships: ${relationships.length}`);
  console.log(`  Interactions:  ${interactions.length}`);
  console.log(`  Facts:         ${facts.length}`);
  console.log(`  Tasks:         ${tasks.length}`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
