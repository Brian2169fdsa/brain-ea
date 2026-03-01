const axios = require("axios");
require("dotenv").config({ path: require("path").resolve(__dirname, "../..", ".env") });

// Proxy support
const proxyUrl = process.env.HTTPS_PROXY || process.env.GLOBAL_AGENT_HTTPS_PROXY;
if (proxyUrl) {
  const { HttpsProxyAgent } = require("https-proxy-agent");
  axios.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl);
  axios.defaults.proxy = false;
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

let cachedToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });

  try {
    const response = await axios.post(TOKEN_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;
    return cachedToken;
  } catch (error) {
    const status = error.response?.status || "unknown";
    const body = error.response?.data || error.message;
    console.error(`[Graph Auth] Error (${status}):`, JSON.stringify(body, null, 2));
    throw new Error(`Graph authentication failed: ${status}`);
  }
}

async function graphRequest(method, endpoint, data = null, params = {}) {
  const token = await getAppToken();
  const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_BASE}${endpoint}`;

  try {
    const config = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params,
    };
    if (data) config.data = data;

    const response = await axios(config);
    return response.data;
  } catch (error) {
    const status = error.response?.status || "unknown";
    const body = error.response?.data || error.message;
    console.error(`[Graph API ${method.toUpperCase()} ${endpoint}] Error (${status}):`, JSON.stringify(body, null, 2));
    throw error;
  }
}

async function getUsers() {
  return graphRequest("get", "/users", null, { $top: 100 });
}

async function getUserMeetings(userId, sinceMinutes = 30) {
  const since = new Date(Date.now() - sinceMinutes * 60000).toISOString();
  return graphRequest("get", `/users/${userId}/onlineMeetings`, null, {
    $filter: `startDateTime ge ${since}`,
  });
}

async function getMeetingTranscript(userId, meetingId) {
  const transcripts = await graphRequest(
    "get",
    `/users/${userId}/onlineMeetings/${meetingId}/transcripts`
  );
  if (!transcripts.value || transcripts.value.length === 0) return null;

  const transcriptId = transcripts.value[0].id;
  return graphRequest(
    "get",
    `/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
    null,
    { $format: "text/vtt" }
  );
}

async function getUserMessages(userId, sinceMinutes = 15) {
  const since = new Date(Date.now() - sinceMinutes * 60000).toISOString();
  return graphRequest("get", `/users/${userId}/messages`, null, {
    $filter: `receivedDateTime ge ${since}`,
    $select: "subject,from,toRecipients,body,receivedDateTime",
    $top: 50,
  });
}

async function sendTeamsDM(userId, recipientEmail, message) {
  // Create 1:1 chat
  const chat = await graphRequest("post", "/chats", {
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${userId}')`,
      },
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientEmail}')`,
      },
    ],
  });

  // Send message
  return graphRequest("post", `/chats/${chat.id}/messages`, {
    body: { contentType: "html", content: `${message}<br><br><em>Sent via Claude EA</em>` },
  });
}

async function sendChannelMessage(teamId, channelId, message) {
  return graphRequest("post", `/teams/${teamId}/channels/${channelId}/messages`, {
    body: { contentType: "html", content: `${message}<br><br><em>Sent via Claude EA</em>` },
  });
}

function isConfigured() {
  return !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET);
}

module.exports = {
  getAppToken,
  graphRequest,
  getUsers,
  getUserMeetings,
  getMeetingTranscript,
  getUserMessages,
  sendTeamsDM,
  sendChannelMessage,
  isConfigured,
};
