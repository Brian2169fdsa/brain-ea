const { Client } = require("@notionhq/client");
require("dotenv").config({ path: require("path").resolve(__dirname, "../..", ".env") });

const RATE_LIMIT_DELAY = 350; // ms between sequential Notion API calls

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notionRequest(fn, label = "Notion API") {
  try {
    const result = await fn();
    await sleep(RATE_LIMIT_DELAY);
    return result;
  } catch (error) {
    const status = error?.status || error?.response?.status || "unknown";
    const body = error?.body || error?.response?.data || error?.message;
    console.error(`[${label}] Error (${status}):`, JSON.stringify(body, null, 2));
    throw error;
  }
}

async function createDatabase(parentPageId, title, properties) {
  return notionRequest(
    () =>
      notion.databases.create({
        parent: { type: "page_id", page_id: parentPageId },
        title: [{ type: "text", text: { content: title } }],
        properties,
      }),
    `Create DB: ${title}`
  );
}

async function queryDatabase(databaseId, filter = undefined, sorts = undefined, pageSize = 100) {
  const pages = [];
  let cursor = undefined;
  do {
    const params = { database_id: databaseId, page_size: pageSize };
    if (filter) params.filter = filter;
    if (sorts) params.sorts = sorts;
    if (cursor) params.start_cursor = cursor;
    const response = await notionRequest(
      () => notion.databases.query(params),
      `Query DB: ${databaseId}`
    );
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function createPage(databaseId, properties, children = []) {
  const params = {
    parent: { database_id: databaseId },
    properties,
  };
  if (children.length > 0) params.children = children;
  return notionRequest(() => notion.pages.create(params), "Create Page");
}

async function updatePage(pageId, properties) {
  return notionRequest(
    () => notion.pages.update({ page_id: pageId, properties }),
    `Update Page: ${pageId}`
  );
}

async function updateDatabase(databaseId, properties) {
  return notionRequest(
    () => notion.databases.update({ database_id: databaseId, properties }),
    `Update DB: ${databaseId}`
  );
}

async function getPage(pageId) {
  return notionRequest(() => notion.pages.retrieve({ page_id: pageId }), `Get Page: ${pageId}`);
}

async function getBlockChildren(blockId) {
  const blocks = [];
  let cursor = undefined;
  do {
    const params = { block_id: blockId, page_size: 100 };
    if (cursor) params.start_cursor = cursor;
    const response = await notionRequest(
      () => notion.blocks.children.list(params),
      `Get Blocks: ${blockId}`
    );
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function appendBlocks(blockId, children) {
  return notionRequest(
    () => notion.blocks.children.append({ block_id: blockId, children }),
    `Append Blocks: ${blockId}`
  );
}

// Helper: build a rich_text property value
function richText(content) {
  if (!content) return { rich_text: [] };
  return { rich_text: [{ type: "text", text: { content: String(content) } }] };
}

// Helper: build a title property value
function titleProp(content) {
  return { title: [{ type: "text", text: { content: String(content) } }] };
}

// Helper: build a select property value
function selectProp(name) {
  if (!name) return { select: null };
  return { select: { name } };
}

// Helper: build a multi_select property value
function multiSelectProp(names) {
  return { multi_select: names.map((name) => ({ name })) };
}

// Helper: build a date property value
function dateProp(dateStr) {
  if (!dateStr) return { date: null };
  return { date: { start: dateStr } };
}

// Helper: build a number property value
function numberProp(value) {
  if (value === null || value === undefined) return { number: null };
  return { number: value };
}

// Helper: build a relation property value
function relationProp(pageIds) {
  return { relation: pageIds.map((id) => ({ id })) };
}

// Helper: build a checkbox property value
function checkboxProp(value) {
  return { checkbox: !!value };
}

// Helper: build a status property value
function statusProp(name) {
  return { status: { name } };
}

// Helper: build an email property value
function emailProp(email) {
  if (!email) return { email: null };
  return { email };
}

// Helper: build a phone_number property value
function phoneProp(phone) {
  if (!phone) return { phone_number: null };
  return { phone_number: phone };
}

// Helper: extract plain text from a Notion rich_text array
function extractText(richTextArr) {
  if (!richTextArr || !Array.isArray(richTextArr)) return "";
  return richTextArr.map((t) => t.plain_text || "").join("");
}

// Helper: extract title text from a Notion page
function extractTitle(page) {
  const tp = Object.values(page.properties).find((p) => p.type === "title");
  if (!tp) return "";
  return extractText(tp.title);
}

module.exports = {
  notion,
  notionRequest,
  createDatabase,
  queryDatabase,
  createPage,
  updatePage,
  updateDatabase,
  getPage,
  getBlockChildren,
  appendBlocks,
  sleep,
  richText,
  titleProp,
  selectProp,
  multiSelectProp,
  dateProp,
  numberProp,
  relationProp,
  checkboxProp,
  statusProp,
  emailProp,
  phoneProp,
  extractText,
  extractTitle,
  RATE_LIMIT_DELAY,
};
