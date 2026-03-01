#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  getAppToken,
  graphRequest,
  isConfigured,
} = require("./utils/graph-client");

async function testEndpoint(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}: SUCCESS`);
    return { label, success: true, data: result };
  } catch (error) {
    const status = error.response?.status || error.status || "unknown";
    const code = error.response?.data?.error?.code || "";
    const message = error.response?.data?.error?.message || error.message || "";
    console.log(`  ✗ ${label}: FAILED (${status}) ${code}`);
    if (message) console.log(`    ${message.substring(0, 200)}`);
    return { label, success: false, status, code, message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Script 05: Test Microsoft Graph API");
  console.log("═══════════════════════════════════════════════════\n");

  if (!isConfigured()) {
    console.error("ERROR: Azure AD credentials not set in .env");
    console.log("\nRequired environment variables:");
    console.log("  AZURE_CLIENT_ID");
    console.log("  AZURE_TENANT_ID");
    console.log("  AZURE_CLIENT_SECRET");
    console.log("\nSet these in your .env file and run again.");
    process.exit(1);
  }

  // Step 1: Authenticate
  console.log("Step 1: Authenticating with Azure AD...");
  let token;
  try {
    token = await getAppToken();
    console.log("  ✓ Authentication successful\n");
  } catch (error) {
    console.error("  ✗ Authentication FAILED");
    console.error("  Check your AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET");
    process.exit(1);
  }

  // Step 2: Test endpoints
  console.log("Step 2: Testing API endpoints...\n");
  const results = [];

  // Test /me — expected to fail with app-only token
  results.push(
    await testEndpoint("GET /me (expected to fail with app-only token)", () =>
      graphRequest("get", "/me")
    )
  );

  // Test /users
  const usersResult = await testEndpoint("GET /users", () =>
    graphRequest("get", "/users", null, { $top: 5 })
  );
  results.push(usersResult);

  let testUserId = null;
  if (usersResult.success && usersResult.data?.value?.length > 0) {
    testUserId = usersResult.data.value[0].id;
    const userName = usersResult.data.value[0].displayName;
    console.log(`    Using test user: ${userName} (${testUserId})\n`);

    // Test online meetings
    results.push(
      await testEndpoint(`GET /users/${testUserId}/onlineMeetings`, () =>
        graphRequest("get", `/users/${testUserId}/onlineMeetings`)
      )
    );

    // Test messages (mail)
    results.push(
      await testEndpoint(`GET /users/${testUserId}/messages`, () =>
        graphRequest("get", `/users/${testUserId}/messages`, null, {
          $top: 5,
          $select: "subject,from,receivedDateTime",
        })
      )
    );

    // Test calendar events
    results.push(
      await testEndpoint(`GET /users/${testUserId}/events`, () =>
        graphRequest("get", `/users/${testUserId}/events`, null, { $top: 5 })
      )
    );

    // Test chats
    results.push(
      await testEndpoint(`GET /users/${testUserId}/chats`, () =>
        graphRequest("get", `/users/${testUserId}/chats`, null, { $top: 5 })
      )
    );
  }

  // Step 3: Print summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════\n");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const r of results) {
    console.log(`  ${r.success ? "✓" : "✗"} ${r.label}`);
  }

  console.log(`\n  Passed: ${passed} | Failed: ${failed}\n`);

  // Step 4: Print permission guidance
  const failedEndpoints = results.filter((r) => !r.success && r.label !== "GET /me (expected to fail with app-only token)");

  if (failedEndpoints.length > 0) {
    console.log("═══════════════════════════════════════════════════");
    console.log("  MISSING PERMISSIONS — ACTION REQUIRED");
    console.log("═══════════════════════════════════════════════════\n");

    for (const f of failedEndpoints) {
      if (f.label.includes("onlineMeetings")) {
        console.log("  📋 Online Meetings:");
        console.log("    Required permission: OnlineMeetings.Read.All (Application)");
        console.log("    Azure Portal → App registrations → API permissions → Add → Microsoft Graph → Application");
        console.log("    Then: Grant admin consent\n");
      }
      if (f.label.includes("messages")) {
        console.log("  📋 Mail:");
        console.log("    Required permission: Mail.Read (Application)");
        console.log("    Azure Portal → App registrations → API permissions → Add → Microsoft Graph → Application");
        console.log("    Then: Grant admin consent\n");
      }
      if (f.label.includes("events")) {
        console.log("  📋 Calendar:");
        console.log("    Required permission: Calendars.Read (Application)");
        console.log("    Azure Portal → App registrations → API permissions → Add → Microsoft Graph → Application");
        console.log("    Then: Grant admin consent\n");
      }
      if (f.label.includes("chats")) {
        console.log("  📋 Chats:");
        console.log("    Required permission: Chat.Read.All (Application)");
        console.log("    Azure Portal → App registrations → API permissions → Add → Microsoft Graph → Application");
        console.log("    Then: Grant admin consent\n");
      }
      if (f.label.includes("/users")) {
        console.log("  📋 Users:");
        console.log("    Required permission: User.Read.All (Application)");
        console.log("    Azure Portal → App registrations → API permissions → Add → Microsoft Graph → Application");
        console.log("    Then: Grant admin consent\n");
      }
    }

    console.log("  For transcript access specifically:");
    console.log("  Required: OnlineMeetingTranscript.Read.All (Application)");
    console.log("  This permission may require admin approval from your M365 admin.\n");
  }

  console.log("NOTE: For delegated permissions (sending messages, reading mail as user),");
  console.log("Make.com handles the OAuth flow interactively. This script only tests");
  console.log("app-level permissions used by scheduled ingestion scenarios.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
