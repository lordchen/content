const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "..");
const BRAND_CONFIG_PATH = path.join(ROOT_DIR, "configs", "brands", "adidas_tuan_gou_douyin.json");
const PROFILE_DIR = path.join(ROOT_DIR, "data", "browser-profiles", "douyin-auth");
const OUTPUT_DIR = path.join(ROOT_DIR, "data", "browser-captures", "douyin-category");
const STATE_PATH = path.join(ROOT_DIR, "data", "auth", "douyin-storage-state.json");

async function main() {
  ensurePathExists(PROFILE_DIR, "未找到登录态 profile，请先运行 npm run douyin:login");

  const brandConfig = JSON.parse(fs.readFileSync(BRAND_CONFIG_PATH, "utf8"));
  const queries = resolveQueries(brandConfig);
  if (!queries.length) {
    throw new Error("品牌配置里没有 douyin_category_queries");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const headed = process.argv.includes("--headed");
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headed,
    channel: "chrome",
    viewport: { width: 1440, height: 960 },
  });

  try {
    const page = await context.newPage();
    const results = [];
    let manualVerificationPassed = false;

    for (const query of queries) {
      let result = await captureQuery(page, query);

      if (result.status === "captcha_blocked") {
        result = await retryQuery(page, query, { attempts: 3, delayMs: 3000 });
      }

      result.screenshot_path = await saveQueryScreenshot(page, query, result.status);

      results.push(result);

      if (result.status === "captcha_blocked" && headed) {
        if (!manualVerificationPassed) {
          console.log("");
          console.log(`查询 "${query}" 遇到验证码。`);
          console.log("请在打开的浏览器里完成人工验证，然后回到终端按回车继续。");
          console.log("");
          await waitForEnter();
          manualVerificationPassed = true;
        } else {
          console.log(`查询 "${query}" 初次判断为验证码页，先自动重试，不立即要求人工操作。`);
        }

        await page.waitForTimeout(2500);
        const retried = await retryQuery(page, query, { attempts: 4, delayMs: 2500 });
        retried.retry_after_manual_step = true;
        retried.screenshot_path = await saveQueryScreenshot(page, query, retried.status);
        results[results.length - 1] = retried;
      }
    }

    await context.storageState({ path: STATE_PATH });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(OUTPUT_DIR, `${stamp}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          brand_name: brandConfig.brand_name,
          captured_at: new Date().toISOString(),
          query_count: results.length,
          headed_mode: headed,
          results,
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log(`类目采集结果已输出: ${outPath}`);
    for (const result of results) {
      console.log(`${result.query}: title=${result.title} status=${result.status} logged_in=${result.loggedIn}`);
    }
  } finally {
    await context.close();
  }
}

function resolveQueries(brandConfig) {
  const configured = brandConfig.douyin_category_queries || [];
  const queryIndex = process.argv.indexOf("--query");
  const queryListIndex = process.argv.indexOf("--queries");

  if (queryIndex >= 0 && process.argv[queryIndex + 1]) {
    return [process.argv[queryIndex + 1].trim()].filter(Boolean);
  }

  if (queryListIndex >= 0 && process.argv[queryListIndex + 1]) {
    return process.argv[queryListIndex + 1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return configured.slice(0, 3);
}

async function captureQuery(page, query) {
  const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);

  return readPageState(page, query);
}

async function retryQuery(page, query, options) {
  let latest = await readPageState(page, query);
  for (let index = 0; index < options.attempts; index += 1) {
    if (latest.status === "ok") {
      return latest;
    }
    await page.waitForTimeout(options.delayMs);
    latest = await readPageState(page, query);
    if (latest.status === "ok") {
      return latest;
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(options.delayMs);
    latest = await readPageState(page, query);
  }
  return latest;
}

async function saveQueryScreenshot(page, query, status) {
  const safeQuery = query.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40) || "query";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(OUTPUT_DIR, `${stamp}-${safeQuery}-${status}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  return fs.existsSync(screenshotPath) ? screenshotPath : "";
}

async function readPageState(page, query) {
  const title = await page.title();
  const html = await page.content();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const mergedText = `${title}\n${bodyText}\n${html}`;
  const blockedByCaptcha = /验证码中间页|sec_sdk_build\/.*captcha|输入验证码|请完成验证|captcha/.test(mergedText);
  const requiresLogin = /请先登录|登录后|扫码登录/.test(mergedText);
  const maybeSearchResult =
    /搜索/.test(title) ||
    /相关搜索|综合|视频|用户|直播|商品/.test(bodyText) ||
    /douyin-search|search-result|搜索结果/.test(html);
  const loggedIn = !blockedByCaptcha && !requiresLogin;
  const status = blockedByCaptcha
    ? "captcha_blocked"
    : requiresLogin
      ? "login_required"
      : maybeSearchResult
        ? "ok"
        : "unknown";

  return {
    query,
    url: page.url(),
    title,
    status,
    loggedIn,
    body_preview: bodyText.slice(0, 1000),
    html_preview: html.slice(0, 2000),
  };
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });
}

function ensurePathExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
