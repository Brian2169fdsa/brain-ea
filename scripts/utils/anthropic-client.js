const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config({ path: require("path").resolve(__dirname, "../..", ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

async function extractFacts(systemPrompt, content, type = "transcript") {
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8000,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: `Process this ${type}:\n\n${content}` }],
  });

  const text = response.content[0]?.text || "";
  return parseJsonResponse(text);
}

async function formatBrief(systemPrompt, profileData, temperature = 0.3) {
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4000,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Format an intelligence brief from this data:\n\n${JSON.stringify(profileData, null, 2)}`,
      },
    ],
  });

  return response.content[0]?.text || "";
}

async function draftRecap(systemPrompt, meetingData) {
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Draft a meeting recap from this data:\n\n${JSON.stringify(meetingData, null, 2)}`,
      },
    ],
  });

  return response.content[0]?.text || "";
}

// Strip markdown code fences and parse JSON
function parseJsonResponse(text) {
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON response:", err.message);
    console.error("Raw response (first 500 chars):", cleaned.substring(0, 500));
    throw new Error(`JSON parse error: ${err.message}`);
  }
}

module.exports = {
  client,
  extractFacts,
  formatBrief,
  draftRecap,
  parseJsonResponse,
  DEFAULT_MODEL,
};
