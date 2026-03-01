#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  queryDatabase,
  extractTitle,
  extractText,
} = require("./utils/notion-client");
const { formatBrief } = require("./utils/anthropic-client");

const PROMPTS_DIR = path.resolve(__dirname, "..", "prompts");
const OUTPUT_DIR = path.resolve(__dirname, "..", "output");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 04: Test Relationship Intelligence Query");
  console.log("═══════════════════════════════════════════════════\n");

  const queryName = process.argv[2];
  if (!queryName) {
    console.error('Usage: node scripts/04-test-relationship-query.js "Dave"');
    process.exit(1);
  }

  const relationshipsDb = process.env.NOTION_RELATIONSHIPS_DB;
  const factsDb = process.env.NOTION_FACTS_DB;
  const tasksDb = process.env.NOTION_TASKS_DB;
  const interactionsDb = process.env.NOTION_INTERACTIONS_DB;

  if (!relationshipsDb || !factsDb || !tasksDb || !interactionsDb) {
    console.error("ERROR: Database IDs not set in .env. Run Script 01 first.");
    process.exit(1);
  }

  // Step 1: Find the relationship
  console.log(`Searching for relationship: "${queryName}"...`);
  const relResults = await queryDatabase(relationshipsDb, {
    property: "Name",
    title: { contains: queryName },
  });

  if (relResults.length === 0) {
    console.error(`No relationship found matching "${queryName}"`);
    process.exit(1);
  }

  const rel = relResults[0];
  const relId = rel.id;
  const relName = extractTitle(rel);
  const relType = rel.properties.Type?.select?.name || "Unknown";
  const relStage = rel.properties.Stage?.select?.name || "Unknown";
  const lastInteraction = rel.properties["Last Interaction"]?.date?.start || "Unknown";

  console.log(`  ✓ Found: ${relName} (${relType}, ${relStage})\n`);

  // Step 2: Query Facts DB filtered by this relationship
  console.log("Querying Facts...");
  const facts = await queryDatabase(
    factsDb,
    {
      property: "Relationship",
      relation: { contains: relId },
    },
    [{ property: "Extracted Date", direction: "descending" }]
  );
  console.log(`  ✓ Found ${facts.length} facts\n`);

  // Group facts by category
  const factsByCategory = {};
  for (const f of facts) {
    const category = f.properties.Category?.select?.name || "Other";
    if (!factsByCategory[category]) factsByCategory[category] = [];
    factsByCategory[category].push({
      claim: extractTitle(f),
      speaker: extractText(f.properties.Speaker?.rich_text),
      confidence: f.properties.Confidence?.select?.name,
      sentiment: f.properties.Sentiment?.select?.name,
      status: f.properties.Status?.select?.name,
      dueDate: f.properties["Due Date"]?.date?.start || null,
      extractedDate: f.properties["Extracted Date"]?.date?.start,
      tags: (f.properties.Tags?.multi_select || []).map((t) => t.name),
    });
  }

  // Step 3: Query Tasks DB, Status != Done
  console.log("Querying Tasks...");
  const tasks = await queryDatabase(tasksDb, {
    and: [
      { property: "Relationship", relation: { contains: relId } },
    ],
  });
  const openTasks = tasks.filter((t) => {
    const status = t.properties.Status?.select?.name;
    return status !== "Done";
  });
  console.log(`  ✓ Found ${openTasks.length} open tasks\n`);

  const taskList = openTasks.map((t) => ({
    name: extractTitle(t),
    priority: t.properties.Priority?.select?.name,
    dueDate: t.properties["Due Date"]?.date?.start || null,
    project: t.properties.Project?.select?.name,
    assignedTo: extractText(t.properties["Assigned To"]?.rich_text),
  }));

  // Step 4: Query Interactions DB, sorted by Date desc, limit 5
  console.log("Querying Interactions...");
  const interactions = await queryDatabase(
    interactionsDb,
    {
      property: "Relationships",
      relation: { contains: relId },
    },
    [{ property: "Date", direction: "descending" }]
  );
  const recentInteractions = interactions.slice(0, 5).map((i) => ({
    title: extractTitle(i),
    type: i.properties.Type?.select?.name,
    date: i.properties.Date?.date?.start,
    source: i.properties.Source?.select?.name,
    summary: extractText(i.properties.Summary?.rich_text),
  }));
  console.log(`  ✓ Found ${interactions.length} interactions (showing last ${recentInteractions.length})\n`);

  // Step 5: Build alerts
  const today = new Date().toISOString().split("T")[0];
  const overdueCommitments = (factsByCategory.Commitment || []).filter(
    (f) => f.status === "Active" && f.dueDate && f.dueDate < today
  );
  const unresolvedConcerns = (factsByCategory.Concern || []).filter(
    (f) => f.status === "Active"
  );

  const daysSinceContact = lastInteraction !== "Unknown"
    ? Math.floor((new Date() - new Date(lastInteraction)) / 86400000)
    : null;
  const staleContact = daysSinceContact !== null && daysSinceContact > 7;

  // Step 6: Assemble profile
  const profile = {
    relationship: {
      name: relName,
      type: relType,
      stage: relStage,
      last_interaction: lastInteraction,
      days_since_contact: daysSinceContact,
    },
    facts_by_category: factsByCategory,
    open_tasks: taskList,
    recent_interactions: recentInteractions,
    alerts: {
      overdue_commitments: overdueCommitments.map((c) => c.claim),
      stale_contact: staleContact,
      unresolved_concerns: unresolvedConcerns.map((c) => c.claim),
    },
  };

  console.log("Profile assembled. Formatting intelligence brief...\n");

  // Step 7: Send to Claude API with relationship-brief prompt
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("NOTE: ANTHROPIC_API_KEY not set. Printing raw profile instead.\n");
    console.log(JSON.stringify(profile, null, 2));
  } else {
    const briefPrompt = fs.readFileSync(
      path.join(PROMPTS_DIR, "relationship-brief.md"),
      "utf8"
    );

    const brief = await formatBrief(briefPrompt, profile);

    console.log("═══════════════════════════════════════════════════");
    console.log("  INTELLIGENCE BRIEF");
    console.log("═══════════════════════════════════════════════════\n");
    console.log(brief);

    // Save output
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `relationship-brief-${queryName.toLowerCase().replace(/\s+/g, "-")}.md`);
    fs.writeFileSync(outputPath, brief);
    console.log(`\n💾 Saved to ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
