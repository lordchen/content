#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const PROFILE_DIR = path.join(ROOT_DIR, "data", "browser-profiles", "douyin-auth");
const STATE_PATH = path.join(ROOT_DIR, "data", "auth", "douyin-storage-state.json");
const OUT_DIR = path.join(ROOT_DIR, "data", "douyin_tuan_gou_top15");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const QUERY_LIST = ["抖音团购", "团购", "抖音团购达人", "本地团购", "团购带货"];
const MAX_ROWS = 15;
const SHEET_TITLE = `抖音团购Top15-${new Date().toISOString().slice(0, 10)}`;

function ensurePaths() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function main() {
  ensurePaths();
  if (!fs.existsSync(PROFILE_DIR)) {
    throw new Error("未找到抖音浏览器 profile，请先运行 npm run douyin:login");
  }
  if (!fs.existsSync(STATE_PATH)) {
    throw new Error("未找到抖音登录态，请先运行 npm run douyin:login");
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 960 },
  });

  const page = await context.newPage();
  const rows = [];

  try {
    for (const query of QUERY_LIST) {
      await page.goto(`https://www.douyin.com/search/${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(5000);
      const pageRows = await extractRows(page, query);
      rows.push(...pageRows);
      if (uniqBy(rows, (row) => row.videoUrl).length >= MAX_ROWS) break;
    }
  } finally {
    await context.storageState({ path: STATE_PATH }).catch(() => null);
    await context.close();
  }

  const deduped = uniqBy(rows, (row) => row.videoUrl).slice(0, MAX_ROWS);
  const payload = {
    fetchedAt: new Date().toISOString(),
    queryList: QUERY_LIST,
    count: deduped.length,
    rows: deduped,
  };

  const jsonPath = path.join(OUT_DIR, `${STAMP}.json`);
  const csvPath = path.join(OUT_DIR, `${STAMP}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(csvPath, toCsv(deduped), "utf8");

  const feishu = tryWriteFeishu(deduped);
  process.stdout.write(
    JSON.stringify(
      {
        count: deduped.length,
        localJson: jsonPath,
        localCsv: csvPath,
        feishu,
      },
      null,
      2,
    ),
  );
}

async function extractRows(page, query) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const hrefs = await page.locator('a[href*="/video/"]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.href,
      text: (node.innerText || node.textContent || "").trim(),
    })),
  ).catch(() => []);

  const videos = [];
  for (const item of hrefs) {
    const videoUrl = item.href.split("?")[0];
    if (!/douyin\.com\/video\/\d+/.test(videoUrl)) continue;
    const title = item.text || inferTitle(bodyText, videoUrl);
    if (!title) continue;
    videos.push({
      query,
      title,
      videoUrl,
      sourcePage: page.url(),
      sourceTitle: await page.title().catch(() => ""),
      note: pickNote(bodyText, title),
    });
  }

  return uniqBy(videos, (row) => row.videoUrl);
}

function inferTitle(bodyText, videoUrl) {
  const lines = bodyText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.find((line) => line.includes("团购") && line.length <= 40);
  if (candidate) return candidate;
  return videoUrl;
}

function pickNote(bodyText, title) {
  const idx = bodyText.indexOf(title);
  if (idx < 0) return "";
  return bodyText.slice(Math.max(0, idx - 120), Math.min(bodyText.length, idx + 240)).replace(/\s+/g, " ").trim();
}

function toCsv(rows) {
  const header = ["排名", "标题", "视频链接", "来源页", "来源标题", "备注"];
  const lines = [header.join(",")];
  rows.forEach((row, index) => {
    const values = [index + 1, row.title, row.videoUrl, row.sourcePage, row.sourceTitle, row.note].map((value) => {
      const s = String(value ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(","));
  });
  return lines.join("\n");
}

function tryWriteFeishu(rows) {
  const headers = JSON.stringify(["排名", "标题", "视频链接", "来源页", "来源标题", "备注"]);
  const data = JSON.stringify(
    rows.map((row, index) => [String(index + 1), row.title, row.videoUrl, row.sourcePage, row.sourceTitle, row.note]),
  );
  try {
    const output = execFileSync(
      "/opt/homebrew/bin/lark-cli",
      ["sheets", "+create", "--title", SHEET_TITLE, "--headers", headers, "--data", data],
      { cwd: ROOT_DIR, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    return { ok: true, output };
  } catch (error) {
    return {
      ok: false,
      error: String(error && error.stderr ? error.stderr : error.message || error),
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
