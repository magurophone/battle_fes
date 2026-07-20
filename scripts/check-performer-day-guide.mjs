import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const DESKTOP_SHOT = "output/review/performer-day-guide-desktop.png";
const MOBILE_SHOT = "output/review/performer-day-guide-mobile.png";
const EXPECTED_COMMENT = "⚔️ご案内⚔️\nこの枠はリレー配信中のため、ご挨拶や個別リアクションができないことがあります\n応援とても嬉しいです！どうぞ最後までお楽しみください✨";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const root = path.resolve("public");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const requested = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const filePath = path.resolve(root, requested.slice(1));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end();
      return;
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function waitForVisuals(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error(`image failed: ${image.currentSrc || image.src}`)), { once: true });
      });
    }));
  });
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".rule-card"));
    const critical = document.querySelector(".critical").getBoundingClientRect();
    return {
      title: document.title,
      text: document.body.textContent.replace(/\s+/g, " ").trim(),
      cardCount: cards.length,
      cardTops: cards.map((card) => Math.round(card.getBoundingClientRect().top)),
      cardWidths: cards.map((card) => Math.round(card.getBoundingClientRect().width)),
      critical: { left: critical.left, right: critical.right, top: critical.top, bottom: critical.bottom },
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      copyDisabled: document.getElementById("copyComment").disabled,
      commentEmpty: document.getElementById("periodicComment").classList.contains("is-empty"),
      logoCount: document.querySelectorAll(".brand-lockup img").length,
      noindex: document.querySelector('meta[name="robots"]')?.content || "",
    };
  });
}

await mkdir("output/review", { recursive: true });
const { server, port } = await startStaticServer();
const browser = await chromium.launch(existsSync(EDGE_EXECUTABLE) ? { executablePath: EDGE_EXECUTABLE } : {});
const url = `http://127.0.0.1:${port}/materials/performer-day-guide.html`;

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  await desktop.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://127.0.0.1:${port}` });
  const desktopErrors = watchErrors(desktop);
  await desktop.goto(url, { waitUntil: "networkidle" });
  await waitForVisuals(desktop);
  const desktopState = await inspectPage(desktop);

  assert.equal(desktopState.title, "BATTLE FES 2026 — 出演者向け当日進行ガイド");
  assert.equal(desktopState.cardCount, 4);
  assert.equal(new Set(desktopState.cardTops).size, 2, "desktop cards must form two rows");
  assert.equal(new Set(desktopState.cardWidths).size, 1, "desktop cards must have equal widths");
  assert.ok(desktopState.text.includes("出演者側の投票は禁止です"));
  assert.ok(desktopState.text.includes("21:00開始 → 20:58から配信可能"));
  assert.ok(desktopState.text.includes("次の出演者をフォロー一覧の一番上"));
  assert.ok(desktopState.text.includes("キーワードが分かる状態"));
  assert.ok(desktopState.text.includes("とてつもないペナルティ"));
  assert.equal(desktopState.copyDisabled, false);
  assert.equal(desktopState.commentEmpty, false);
  assert.equal(desktopState.logoCount, 0);
  assert.equal(desktopState.noindex, "noindex,nofollow,noarchive");
  assert.equal(desktopState.scrollWidth, desktopState.viewportWidth);
  assert.ok(desktopState.critical.left >= 0 && desktopState.critical.right <= desktopState.viewportWidth);

  assert.equal(await desktop.locator("#copyComment").isEnabled(), true);
  await desktop.locator("#copyComment").click();
  await desktop.waitForFunction(() => document.getElementById("copyStatus")?.textContent === "コピーしました");
  assert.equal(await desktop.locator("#copyStatus").textContent(), "コピーしました");
  const clipboardText = await desktop.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText.replace(/\r\n/g, "\n"), EXPECTED_COMMENT);
  await desktop.evaluate(() => window.__setPeriodicComment(""));
  assert.equal(await desktop.locator("#copyComment").isDisabled(), true);
  await desktop.evaluate((comment) => window.__setPeriodicComment(comment), EXPECTED_COMMENT);
  await desktop.screenshot({ path: DESKTOP_SHOT, fullPage: true });
  assert.deepEqual(desktopErrors, []);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobileErrors = watchErrors(mobile);
  await mobile.goto(url, { waitUntil: "networkidle" });
  await waitForVisuals(mobile);
  const mobileState = await inspectPage(mobile);

  assert.equal(mobileState.cardCount, 4);
  assert.equal(new Set(mobileState.cardTops).size, 4, "mobile cards must stack vertically");
  assert.ok(mobileState.cardWidths.every((width) => width === mobileState.cardWidths[0]));
  assert.equal(mobileState.copyDisabled, false);
  assert.equal(mobileState.commentEmpty, false);
  assert.equal(mobileState.scrollWidth, mobileState.viewportWidth);
  assert.ok(mobileState.critical.left >= 0 && mobileState.critical.right <= mobileState.viewportWidth);
  await mobile.screenshot({ path: MOBILE_SHOT, fullPage: true });
  assert.deepEqual(mobileErrors, []);
  await mobile.close();

  console.log(`verified desktop and mobile: ${url}`);
  console.log(`saved ${DESKTOP_SHOT}`);
  console.log(`saved ${MOBILE_SHOT}`);
} finally {
  await browser.close();
  server.close();
}
