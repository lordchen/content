const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "..");
const PROFILE_DIR = path.join(ROOT_DIR, "data", "browser-profiles", "douyin-auth");
const STATE_PATH = path.join(ROOT_DIR, "data", "auth", "douyin-storage-state.json");

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 960 },
  });

  const page = await context.newPage();
  await page.goto("https://www.douyin.com/", { waitUntil: "domcontentloaded" });

  console.log("");
  console.log("请在打开的浏览器里完成抖音登录。");
  console.log("登录完成后，回到终端按回车继续保存登录态。");
  console.log("");

  await waitForEnter();

  await context.storageState({ path: STATE_PATH });
  console.log(`登录态已保存: ${STATE_PATH}`);
  console.log(`浏览器 profile 已保存: ${PROFILE_DIR}`);

  await context.close();
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
