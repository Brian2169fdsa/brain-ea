#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  notion,
  notionRequest,
  createDatabase,
  updateDatabase,
  sleep,
} = require("./utils/notion-client");

const OUTPUT_DIR = path.resolve(__dirname, "..", "output");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 01: Create Notion Databases");
  console.log("═══════════════════════════════════════════════════\n");

  if (!process.env.NOTION_TOKEN) {
    console.error("ERROR: NOTION_TOKEN not set in .env");
    process.exit(1);
  }

  // Step 1: Create a workspace page as parent for all databases
  const notionParentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!notionParentPageId) {
    console.error("ERROR: NOTION_PARENT_PAGE_ID not set in .env");
    process.exit(1);
  }

  console.log("Creating workspace page: Claude EA...");
  const workspacePage = await notionRequest(() =>
    notion.pages.create({
      parent: { type: "page_id", page_id: notionParentPageId },
      properties: {
        title: [{ type: "text", text: { content: "Claude EA" } }],
      },
    }),
    "Create Workspace Page"
  );
  const parentPageId = workspacePage.id;
  console.log(`  ✓ Workspace page created (ID: ${parentPageId})\n`);

  // Step 2: Create all 5 databases (without cross-DB relations)
  // --- Database 1: Relationships ---
  console.log("Creating Relationships database...");
  const relationshipsDb = await createDatabase(parentPageId, "Relationships", {
    Name: { title: {} },
    Type: {
      select: {
        options: [
          { name: "Person", color: "blue" },
          { name: "Company", color: "green" },
          { name: "Partner", color: "purple" },
          { name: "Investor", color: "yellow" },
          { name: "Internal Team", color: "orange" },
          { name: "Vendor", color: "red" },
          { name: "Other", color: "gray" },
        ],
      },
    },
    Company: { rich_text: {} },
    Email: { email: {} },
    Phone: { phone_number: {} },
    Stage: {
      select: {
        options: [
          { name: "Lead", color: "gray" },
          { name: "Active", color: "blue" },
          { name: "Engaged", color: "green" },
          { name: "Closed Won", color: "green" },
          { name: "Closed Lost", color: "red" },
          { name: "Dormant", color: "brown" },
          { name: "Internal", color: "orange" },
        ],
      },
    },
    Owner: { rich_text: {} },
    "Last Interaction": { date: {} },
    Tags: {
      multi_select: {
        options: [
          { name: "ManageAI", color: "blue" },
          { name: "Sanctuary", color: "green" },
          { name: "New Freedom", color: "purple" },
          { name: "Pipedrive", color: "yellow" },
          { name: "Client", color: "orange" },
          { name: "Prospect", color: "red" },
        ],
      },
    },
    Notes: { rich_text: {} },
    "Pipedrive Person ID": { number: {} },
    "Pipedrive Org ID": { number: {} },
  });
  const relationshipsDbId = relationshipsDb.id;
  console.log(`  ✓ Relationships DB created (ID: ${relationshipsDbId})\n`);

  // --- Database 2: Facts ---
  console.log("Creating Facts database...");
  const factsDb = await createDatabase(parentPageId, "Facts", {
    Fact: { title: {} },
    Category: {
      select: {
        options: [
          { name: "Commitment", color: "red" },
          { name: "Decision", color: "blue" },
          { name: "Concern", color: "yellow" },
          { name: "Feedback", color: "purple" },
          { name: "Priority", color: "orange" },
          { name: "Preference", color: "pink" },
          { name: "Context", color: "gray" },
          { name: "Request", color: "green" },
          { name: "Milestone", color: "blue" },
        ],
      },
    },
    Speaker: { rich_text: {} },
    "Source Timestamp": { rich_text: {} },
    Confidence: {
      select: {
        options: [
          { name: "High", color: "green" },
          { name: "Medium", color: "yellow" },
          { name: "Low", color: "red" },
        ],
      },
    },
    Status: {
      select: {
        options: [
          { name: "Active", color: "green" },
          { name: "Fulfilled", color: "blue" },
          { name: "Expired", color: "gray" },
          { name: "Superseded", color: "yellow" },
          { name: "Disputed", color: "red" },
        ],
      },
    },
    "Due Date": { date: {} },
    "Extracted Date": { date: {} },
    Sentiment: {
      select: {
        options: [
          { name: "Positive", color: "green" },
          { name: "Neutral", color: "gray" },
          { name: "Negative", color: "red" },
          { name: "Urgent", color: "orange" },
        ],
      },
    },
    Tags: {
      multi_select: {
        options: [
          { name: "pricing", color: "blue" },
          { name: "product", color: "green" },
          { name: "timeline", color: "yellow" },
          { name: "budget", color: "orange" },
          { name: "legal", color: "red" },
          { name: "technical", color: "purple" },
          { name: "hiring", color: "pink" },
          { name: "partnership", color: "gray" },
        ],
      },
    },
  });
  const factsDbId = factsDb.id;
  console.log(`  ✓ Facts DB created (ID: ${factsDbId})\n`);

  // --- Database 3: Interactions ---
  console.log("Creating Interactions database...");
  const interactionsDb = await createDatabase(parentPageId, "Interactions", {
    Title: { title: {} },
    Type: {
      select: {
        options: [
          { name: "Meeting Transcript", color: "blue" },
          { name: "Email", color: "green" },
          { name: "Teams Chat", color: "purple" },
          { name: "Pipedrive Activity", color: "yellow" },
          { name: "Pipedrive Deal Update", color: "orange" },
          { name: "Manual Note", color: "gray" },
        ],
      },
    },
    Date: { date: {} },
    Source: {
      select: {
        options: [
          { name: "Teams Transcription", color: "blue" },
          { name: "Outlook", color: "green" },
          { name: "Teams Chat", color: "purple" },
          { name: "Pipedrive", color: "yellow" },
          { name: "Manual", color: "gray" },
        ],
      },
    },
    Participants: {
      multi_select: {
        options: [
          { name: "Brian", color: "blue" },
          { name: "Tony", color: "green" },
          { name: "Chad", color: "purple" },
          { name: "Dave", color: "orange" },
          { name: "Jacob", color: "yellow" },
          { name: "Robert", color: "red" },
          { name: "Pat", color: "pink" },
          { name: "Cornerstone", color: "gray" },
        ],
      },
    },
    Summary: { rich_text: {} },
    "Raw Content": { rich_text: {} },
    "External ID": { rich_text: {} },
    Processed: { checkbox: {} },
    "Facts Extracted": { number: {} },
  });
  const interactionsDbId = interactionsDb.id;
  console.log(`  ✓ Interactions DB created (ID: ${interactionsDbId})\n`);

  // --- Database 4: Tasks ---
  console.log("Creating Tasks database...");
  const tasksDb = await createDatabase(parentPageId, "Tasks", {
    Name: { title: {} },
    Status: {
      select: {
        options: [
          { name: "Not started", color: "default" },
          { name: "In progress", color: "blue" },
          { name: "Done", color: "green" },
          { name: "Blocked", color: "red" },
        ],
      },
    },
    Priority: {
      select: {
        options: [
          { name: "P0 (Critical)", color: "red" },
          { name: "P1 (High)", color: "orange" },
          { name: "P2 (Medium)", color: "yellow" },
          { name: "P3 (Low)", color: "gray" },
        ],
      },
    },
    "Due Date": { date: {} },
    Project: {
      select: {
        options: [
          { name: "ManageAI", color: "blue" },
          { name: "Sanctuary", color: "green" },
          { name: "New Freedom", color: "purple" },
          { name: "Personal", color: "pink" },
          { name: "Other", color: "gray" },
        ],
      },
    },
    "Assigned To": { rich_text: {} },
    Notes: { rich_text: {} },
    "Created By": {
      select: {
        options: [
          { name: "Manual", color: "gray" },
          { name: "Claude EA", color: "blue" },
          { name: "Fact Extraction", color: "green" },
          { name: "Pipedrive Sync", color: "yellow" },
        ],
      },
    },
  });
  const tasksDbId = tasksDb.id;
  console.log(`  ✓ Tasks DB created (ID: ${tasksDbId})\n`);

  // --- Database 5: Knowledge Base ---
  console.log("Creating Knowledge Base database...");
  const kbDb = await createDatabase(parentPageId, "Knowledge Base", {
    Title: { title: {} },
    Category: {
      select: {
        options: [
          { name: "Processes", color: "blue" },
          { name: "Technical", color: "green" },
          { name: "Clients", color: "purple" },
          { name: "Legal", color: "red" },
          { name: "HR", color: "orange" },
          { name: "General", color: "gray" },
          { name: "Pipedrive", color: "yellow" },
          { name: "Integrations", color: "pink" },
        ],
      },
    },
    Tags: {
      multi_select: {
        options: [
          { name: "automation", color: "blue" },
          { name: "CRM", color: "green" },
          { name: "onboarding", color: "yellow" },
        ],
      },
    },
    "Created By": {
      select: {
        options: [
          { name: "Manual", color: "gray" },
          { name: "Claude EA", color: "blue" },
        ],
      },
    },
  });
  const kbDbId = kbDb.id;
  console.log(`  ✓ Knowledge Base DB created (ID: ${kbDbId})\n`);

  // Step 3: Add cross-database relations
  console.log("Adding cross-database relations...\n");

  // Facts → Relationship (relation to Relationships DB)
  console.log("  Adding Facts.Relationship → Relationships DB...");
  await updateDatabase(factsDbId, {
    Relationship: {
      relation: { database_id: relationshipsDbId, type: "dual_property", dual_property: { synced_property_name: "Facts" } },
    },
  });
  console.log("  ✓ Facts.Relationship ↔ Relationships.Facts\n");

  // Facts → Source Interaction (relation to Interactions DB)
  console.log("  Adding Facts.Source Interaction → Interactions DB...");
  await updateDatabase(factsDbId, {
    "Source Interaction": {
      relation: { database_id: interactionsDbId, type: "dual_property", dual_property: { synced_property_name: "Facts" } },
    },
  });
  console.log("  ✓ Facts.Source Interaction ↔ Interactions.Facts\n");

  // Interactions → Relationships (relation to Relationships DB)
  console.log("  Adding Interactions.Relationships → Relationships DB...");
  await updateDatabase(interactionsDbId, {
    Relationships: {
      relation: { database_id: relationshipsDbId, type: "dual_property", dual_property: { synced_property_name: "Interactions" } },
    },
  });
  console.log("  ✓ Interactions.Relationships ↔ Relationships.Interactions\n");

  // Tasks → Relationship (relation to Relationships DB)
  console.log("  Adding Tasks.Relationship → Relationships DB...");
  await updateDatabase(tasksDbId, {
    Relationship: {
      relation: { database_id: relationshipsDbId, type: "dual_property", dual_property: { synced_property_name: "Tasks" } },
    },
  });
  console.log("  ✓ Tasks.Relationship ↔ Relationships.Tasks\n");

  // Tasks → Source Interaction (relation to Interactions DB)
  console.log("  Adding Tasks.Source Interaction → Interactions DB...");
  await updateDatabase(tasksDbId, {
    "Source Interaction": {
      relation: { database_id: interactionsDbId, type: "dual_property", dual_property: { synced_property_name: "Tasks" } },
    },
  });
  console.log("  ✓ Tasks.Source Interaction ↔ Interactions.Tasks\n");

  // Step 4: Add rollups on Relationships DB
  console.log("Adding rollups on Relationships DB...\n");

  // We need to get the property IDs for the relations we just created
  const updatedRelDb = await notionRequest(
    () => notion.databases.retrieve({ database_id: relationshipsDbId }),
    "Retrieve Relationships DB"
  );

  const factsRelPropId = updatedRelDb.properties["Facts"]?.id;
  const interactionsRelPropId = updatedRelDb.properties["Interactions"]?.id;

  if (factsRelPropId) {
    console.log("  Adding Open Commitments rollup...");
    await updateDatabase(relationshipsDbId, {
      "Open Commitments": {
        rollup: {
          relation_property_name: "Facts",
          rollup_property_name: "Fact",
          function: "count",
        },
      },
    });
    console.log("  ✓ Open Commitments rollup added\n");
  }

  if (interactionsRelPropId) {
    console.log("  Adding Interaction Count rollup...");
    await updateDatabase(relationshipsDbId, {
      "Interaction Count": {
        rollup: {
          relation_property_name: "Interactions",
          rollup_property_name: "Title",
          function: "count",
        },
      },
    });
    console.log("  ✓ Interaction Count rollup added\n");
  }

  // Step 5: Write output
  const dbIds = {
    workspace_page_id: parentPageId,
    relationships_db: relationshipsDbId,
    facts_db: factsDbId,
    interactions_db: interactionsDbId,
    tasks_db: tasksDbId,
    kb_db: kbDbId,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "database-ids.json"),
    JSON.stringify(dbIds, null, 2)
  );

  console.log("═══════════════════════════════════════════════════");
  console.log("  ✓ ALL DATABASES CREATED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════\n");
  console.log("Database IDs saved to output/database-ids.json\n");
  console.log("Add these to your .env file:\n");
  console.log(`NOTION_RELATIONSHIPS_DB=${relationshipsDbId}`);
  console.log(`NOTION_FACTS_DB=${factsDbId}`);
  console.log(`NOTION_INTERACTIONS_DB=${interactionsDbId}`);
  console.log(`NOTION_TASKS_DB=${tasksDbId}`);
  console.log(`NOTION_KB_DB=${kbDbId}`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
