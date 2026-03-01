#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { extractFacts } = require("./utils/anthropic-client");

const PROMPTS_DIR = path.resolve(__dirname, "..", "prompts");
const TEST_DATA_DIR = path.resolve(__dirname, "..", "test-data");
const OUTPUT_DIR = path.resolve(__dirname, "..", "output", "extraction-results");

const VALID_CATEGORIES = [
  "Commitment", "Decision", "Concern", "Feedback",
  "Priority", "Preference", "Context", "Request", "Milestone",
];
const VALID_CONFIDENCE = ["High", "Medium", "Low"];
const VALID_SENTIMENT = ["Positive", "Neutral", "Negative", "Urgent"];

function detectType(filename) {
  if (filename.includes("transcript")) return "transcript";
  if (filename.includes("email")) return "email";
  if (filename.includes("pipedrive")) return "pipedrive_deal";
  return "transcript";
}

function validateFact(fact, index) {
  const errors = [];
  if (!fact.claim) errors.push(`Fact ${index}: missing claim`);
  if (!VALID_CATEGORIES.includes(fact.category)) {
    errors.push(`Fact ${index}: invalid category "${fact.category}"`);
  }
  if (!fact.relationship) errors.push(`Fact ${index}: missing relationship`);
  if (!fact.speaker) errors.push(`Fact ${index}: missing speaker`);
  if (!fact.timestamp) errors.push(`Fact ${index}: missing timestamp`);
  if (!VALID_CONFIDENCE.includes(fact.confidence)) {
    errors.push(`Fact ${index}: invalid confidence "${fact.confidence}"`);
  }
  if (!VALID_SENTIMENT.includes(fact.sentiment)) {
    errors.push(`Fact ${index}: invalid sentiment "${fact.sentiment}"`);
  }
  return errors;
}

function printTable(facts) {
  const maxClaim = 55;
  const header = [
    "Cat".padEnd(12),
    "Claim".padEnd(maxClaim),
    "Speaker".padEnd(10),
    "Conf".padEnd(6),
    "Sent".padEnd(9),
    "Due",
  ].join(" | ");

  console.log("  " + "─".repeat(header.length));
  console.log("  " + header);
  console.log("  " + "─".repeat(header.length));

  for (const f of facts) {
    const claim = f.claim.length > maxClaim ? f.claim.substring(0, maxClaim - 3) + "..." : f.claim;
    console.log("  " + [
      f.category.padEnd(12),
      claim.padEnd(maxClaim),
      (f.speaker || "").padEnd(10),
      (f.confidence || "").padEnd(6),
      (f.sentiment || "").padEnd(9),
      f.due_date || "—",
    ].join(" | "));
  }
  console.log("  " + "─".repeat(header.length));
}

async function processFile(filePath, systemPrompt) {
  const filename = path.basename(filePath);
  const type = detectType(filename);
  const content = fs.readFileSync(filePath, "utf8");

  console.log(`\n📄 Processing: ${filename} (type: ${type})`);
  console.log("  Sending to Claude API...");

  const startTime = Date.now();
  const result = await extractFacts(systemPrompt, content, type);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`  ✓ Response received in ${elapsed}s`);

  if (!result.facts || !Array.isArray(result.facts)) {
    console.error("  ✗ ERROR: response missing 'facts' array");
    return { filename, error: "missing facts array", facts: [], actionItems: [], validationErrors: [] };
  }

  // Validate facts
  const validationErrors = [];
  for (let i = 0; i < result.facts.length; i++) {
    validationErrors.push(...validateFact(result.facts[i], i + 1));
  }

  // Count by category
  const categoryCounts = {};
  for (const f of result.facts) {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
  }

  // Print results
  console.log(`\n  Facts extracted: ${result.facts.length}`);
  console.log(`  Action items: ${(result.action_items || []).length}`);
  console.log(`  Validation errors: ${validationErrors.length}`);

  if (validationErrors.length > 0) {
    console.log("\n  ⚠️ Validation Errors:");
    for (const e of validationErrors) {
      console.log(`    - ${e}`);
    }
  }

  console.log("\n  Category breakdown:");
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  console.log("\n  Facts table:");
  printTable(result.facts);

  if (result.summary) {
    console.log(`\n  Summary: ${result.summary}`);
  }

  if (result.action_items && result.action_items.length > 0) {
    console.log("\n  Action Items:");
    for (const ai of result.action_items) {
      console.log(`    - [${ai.priority}] ${ai.title} (${ai.owner}) ${ai.due_date ? "Due: " + ai.due_date : ""}`);
    }
  }

  return { filename, result, categoryCounts, validationErrors };
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 03: Test Fact Extraction");
  console.log("═══════════════════════════════════════════════════");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\nERROR: ANTHROPIC_API_KEY not set in .env");
    process.exit(1);
  }

  // Load extraction prompt
  const systemPrompt = fs.readFileSync(
    path.join(PROMPTS_DIR, "fact-extraction.md"),
    "utf8"
  );

  // Find test data files
  const files = fs.readdirSync(TEST_DATA_DIR)
    .filter((f) => f.startsWith("sample-"))
    .sort();

  if (files.length === 0) {
    console.error("\nERROR: No test data files found in test-data/");
    process.exit(1);
  }

  console.log(`\nFound ${files.length} test data files: ${files.join(", ")}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process each file
  const allResults = [];
  let totalFacts = 0;
  let totalErrors = 0;
  let totalActionItems = 0;

  for (const file of files) {
    const filePath = path.join(TEST_DATA_DIR, file);
    const { filename, result, categoryCounts, validationErrors } = await processFile(filePath, systemPrompt);

    if (result) {
      // Save individual results
      const outputPath = path.join(OUTPUT_DIR, `${path.parse(filename).name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`  💾 Saved to ${outputPath}`);

      totalFacts += result.facts.length;
      totalActionItems += (result.action_items || []).length;
    }
    totalErrors += (validationErrors || []).length;
    allResults.push({ filename, categoryCounts, validationErrors });
  }

  // Print summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  EXTRACTION SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Files processed: ${files.length}`);
  console.log(`  Total facts extracted: ${totalFacts}`);
  console.log(`  Total action items: ${totalActionItems}`);
  console.log(`  Total validation errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log("\n  ⚠️ Some facts had validation errors. Review the details above.");
  } else {
    console.log("\n  ✓ All facts passed validation.");
  }

  // Aggregate category counts
  const totalByCategory = {};
  for (const r of allResults) {
    if (r.categoryCounts) {
      for (const [cat, count] of Object.entries(r.categoryCounts)) {
        totalByCategory[cat] = (totalByCategory[cat] || 0) + count;
      }
    }
  }

  console.log("\n  Total by category:");
  for (const [cat, count] of Object.entries(totalByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
