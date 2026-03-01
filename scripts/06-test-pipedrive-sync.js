#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  pipedrive,
  getPersons,
  getOrganizations,
  getDeals,
  getActivities,
  getRecentActivities,
  getNotes,
  isConfigured,
} = require("./utils/pipedrive-client");
const {
  queryDatabase,
  extractTitle,
} = require("./utils/notion-client");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 06: Test Pipedrive Sync");
  console.log("═══════════════════════════════════════════════════\n");

  if (!isConfigured()) {
    console.error("ERROR: Pipedrive credentials not set in .env");
    console.log("\nRequired environment variables:");
    console.log("  PIPEDRIVE_API_TOKEN");
    console.log("  PIPEDRIVE_DOMAIN");
    process.exit(1);
  }

  const relationshipsDb = process.env.NOTION_RELATIONSHIPS_DB;

  // Step 1: Test Persons
  console.log("Step 1: Fetching Persons...");
  let persons = [];
  try {
    persons = await getPersons();
    console.log(`  ✓ Found ${persons.length} persons`);
    if (persons.length > 0) {
      console.log("  Sample:");
      for (const p of persons.slice(0, 5)) {
        console.log(`    - ${p.name} (${p.email?.[0]?.value || "no email"}) — org: ${p.org_name || "none"}`);
      }
    }
  } catch (error) {
    console.error("  ✗ Failed to fetch persons:", error.message);
  }

  // Step 2: Test Organizations
  console.log("\nStep 2: Fetching Organizations...");
  let orgs = [];
  try {
    orgs = await getOrganizations();
    console.log(`  ✓ Found ${orgs.length} organizations`);
    if (orgs.length > 0) {
      console.log("  Sample:");
      for (const o of orgs.slice(0, 5)) {
        console.log(`    - ${o.name} (${o.address || "no address"})`);
      }
    }
  } catch (error) {
    console.error("  ✗ Failed to fetch organizations:", error.message);
  }

  // Step 3: Test Deals
  console.log("\nStep 3: Fetching Deals...");
  let deals = [];
  try {
    deals = await getDeals();
    console.log(`  ✓ Found ${deals.length} deals`);
    if (deals.length > 0) {
      console.log("  Summary:");
      const openDeals = deals.filter((d) => d.status === "open");
      const wonDeals = deals.filter((d) => d.status === "won");
      const lostDeals = deals.filter((d) => d.status === "lost");
      console.log(`    Open: ${openDeals.length} | Won: ${wonDeals.length} | Lost: ${lostDeals.length}`);

      console.log("  Recent deals:");
      for (const d of deals.slice(0, 5)) {
        const value = d.value ? `$${d.value.toLocaleString()}` : "no value";
        console.log(`    - ${d.title} — ${d.stage_id ? "Stage " + d.stage_id : "?"} — ${value} — ${d.status}`);
      }
    }
  } catch (error) {
    console.error("  ✗ Failed to fetch deals:", error.message);
  }

  // Step 4: Test Activities
  console.log("\nStep 4: Fetching Recent Activities...");
  try {
    const activities = await getRecentActivities(10);
    console.log(`  ✓ Found ${activities.length} recent activities`);
    if (activities.length > 0) {
      console.log("  Last 10:");
      for (const a of activities) {
        const note = a.note ? a.note.substring(0, 80).replace(/\n/g, " ") + "..." : "no note";
        console.log(`    - [${a.type}] ${a.subject || "untitled"} (${a.due_date || "no date"}) — ${note}`);
      }
    }
  } catch (error) {
    console.error("  ✗ Failed to fetch activities:", error.message);
  }

  // Step 5: Test Deal Flow (for first deal if available)
  if (deals.length > 0) {
    console.log("\nStep 5: Fetching Deal Flow...");
    try {
      const dealId = deals[0].id;
      const result = await pipedrive(`/deals/${dealId}/flow`);
      const flow = result.data || [];
      console.log(`  ✓ Deal "${deals[0].title}" has ${flow.length} flow entries`);
      for (const entry of flow.slice(0, 5)) {
        console.log(`    - ${entry.object || "?"}: ${entry.action || "?"} (${entry.timestamp || "?"})`);
      }
    } catch (error) {
      console.error("  ✗ Failed to fetch deal flow:", error.message);
    }
  }

  // Step 6: Test Notes
  console.log("\nStep 6: Fetching Notes...");
  try {
    const notes = await getNotes();
    console.log(`  ✓ Found ${notes.length} notes`);
    for (const n of notes.slice(0, 5)) {
      const content = (n.content || "").substring(0, 80).replace(/\n/g, " ");
      console.log(`    - ${content}...`);
    }
  } catch (error) {
    console.error("  ✗ Failed to fetch notes:", error.message);
  }

  // Step 7: Sync Plan — compare Pipedrive persons with Notion relationships
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SYNC PLAN");
  console.log("═══════════════════════════════════════════════════\n");

  let toCreate = 0;
  let toUpdate = 0;

  if (relationshipsDb && persons.length > 0) {
    console.log("  Checking Notion for existing matches...\n");

    for (const person of persons) {
      // Check by Pipedrive Person ID
      let found = false;
      try {
        const matches = await queryDatabase(relationshipsDb, {
          or: [
            { property: "Pipedrive Person ID", number: { equals: person.id } },
            { property: "Name", title: { equals: person.name } },
          ],
        });

        if (matches.length > 0) {
          const matchName = extractTitle(matches[0]);
          console.log(`  ✓ ${person.name} → EXISTS in Notion as "${matchName}" (will update)`);
          toUpdate++;
          found = true;
        }
      } catch (error) {
        // Database might not exist yet
      }

      if (!found) {
        console.log(`  ○ ${person.name} → NEW (will be created on sync)`);
        toCreate++;
      }
    }
  } else if (!relationshipsDb) {
    console.log("  NOTE: NOTION_RELATIONSHIPS_DB not set. Skipping Notion comparison.");
    console.log(`  ${persons.length} persons would be synced.\n`);
    toCreate = persons.length;
  }

  // Count activities to extract
  let activitiesToExtract = 0;
  try {
    const allActivities = await getActivities();
    activitiesToExtract = allActivities.filter((a) => a.note && a.note.length > 20).length;
  } catch (_) {}

  console.log("\n  ─────────────────────────");
  console.log(`  Persons to CREATE:    ${toCreate}`);
  console.log(`  Persons to UPDATE:    ${toUpdate}`);
  console.log(`  Organizations:        ${orgs.length}`);
  console.log(`  Deals to process:     ${deals.length}`);
  console.log(`  Activities to extract: ${activitiesToExtract}`);
  console.log("  ─────────────────────────");
  console.log("\n  ⚠️  This is a DRY RUN. No sync operations were executed.");
  console.log("  Run EA-12 Make scenario to perform the actual sync.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
