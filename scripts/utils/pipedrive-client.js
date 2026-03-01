const axios = require("axios");
require("dotenv").config({ path: require("path").resolve(__dirname, "../..", ".env") });

// Proxy support
const proxyUrl = process.env.HTTPS_PROXY || process.env.GLOBAL_AGENT_HTTPS_PROXY;
if (proxyUrl) {
  const { HttpsProxyAgent } = require("https-proxy-agent");
  axios.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl);
  axios.defaults.proxy = false; // let the agent handle proxying
}

const PIPEDRIVE_BASE = `https://${process.env.PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
const RATE_LIMIT_DELAY = 200; // ms between requests

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pipedrive(endpoint, params = {}, method = "get", data = null) {
  const url = `${PIPEDRIVE_BASE}${endpoint}`;
  try {
    const config = {
      method,
      url,
      params: { api_token: process.env.PIPEDRIVE_API_TOKEN, ...params },
    };
    if (data) config.data = data;

    const response = await axios(config);
    await sleep(RATE_LIMIT_DELAY);
    return response.data;
  } catch (error) {
    const status = error.response?.status || "unknown";
    const body = error.response?.data || error.message;
    console.error(`[Pipedrive ${method.toUpperCase()} ${endpoint}] Error (${status}):`, JSON.stringify(body, null, 2));
    throw error;
  }
}

// Paginated fetch — Pipedrive returns max 500 items per request
async function pipedriveAll(endpoint, params = {}) {
  const items = [];
  let start = 0;
  const limit = 500;
  let hasMore = true;

  while (hasMore) {
    const result = await pipedrive(endpoint, { ...params, start, limit });
    if (result.data) {
      items.push(...result.data);
    }
    hasMore = result.additional_data?.pagination?.more_items_in_collection || false;
    start += limit;
  }

  return items;
}

async function getPersons() {
  return pipedriveAll("/persons");
}

async function getOrganizations() {
  return pipedriveAll("/organizations");
}

async function getDeals(params = {}) {
  return pipedriveAll("/deals", params);
}

async function getDeal(dealId) {
  const result = await pipedrive(`/deals/${dealId}`);
  return result.data;
}

async function getDealFlow(dealId) {
  const result = await pipedrive(`/deals/${dealId}/flow`);
  return result.data;
}

async function getActivities(params = {}) {
  return pipedriveAll("/activities", params);
}

async function getRecentActivities(limit = 10) {
  const result = await pipedrive("/activities", {
    start: 0,
    limit,
    sort: "update_time DESC",
  });
  return result.data || [];
}

async function getNotes(params = {}) {
  return pipedriveAll("/notes", params);
}

async function getRecents(sinceTimestamp, items = "person,organization,deal,activity,note") {
  const result = await pipedrive("/recents", {
    since_timestamp: sinceTimestamp,
    items,
    limit: 500,
  });
  return result.data || [];
}

async function searchDeals(term) {
  const result = await pipedrive("/deals/search", { term });
  return result.data?.items || [];
}

function isConfigured() {
  return !!(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMAIN);
}

module.exports = {
  pipedrive,
  pipedriveAll,
  getPersons,
  getOrganizations,
  getDeals,
  getDeal,
  getDealFlow,
  getActivities,
  getRecentActivities,
  getNotes,
  getRecents,
  searchDeals,
  isConfigured,
};
