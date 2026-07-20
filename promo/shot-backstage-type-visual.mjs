import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUTPUT_PATH = "public/assets/promo/backstage-4-type-visual.png";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const publicRoot = path.resolve("public");
  const promoRoot = path.resolve("promo");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    let filePath;
    if (url.pathname.startsWith("/promo/")) {
      filePath = path.resolve(promoRoot, url.pathname.slice("/promo/".length));
      if (!filePath.startsWith(promoRoot)) { response.writeHead(403); response.end(); return; }
    } else {
      filePath = path.resolve(publicRoot, url.pathname.slice(1));
      if (!filePath.startsWith(publicRoot)) { response.writeHead(403); response.end(); return; }
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

await mkdir("public/assets/promo", { recursive: true });
const { server, port } = await startStaticServer();
const browser = await chromium.launch(existsSync(EDGE_EXECUTABLE) ? { executablePath: EDGE_EXECUTABLE } : {});
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.goto(`http://127.0.0.1:${port}/promo/backstage-type-visual.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const state = await page.evaluate(() => {
    const poster = document.querySelector(".poster");
    const posterRect = poster.getBoundingClientRect();
    const targetSelectors = [".title-row", ".countdown-panel", ".font-grid", ".concept-line"];
    const bounds = Object.fromEntries(targetSelectors.map((selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
    }));
    return {
      poster: { width: posterRect.width, height: posterRect.height },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      digitCount: document.querySelectorAll(".digit").length,
      cellCount: document.querySelectorAll(".counter-cell").length,
      fontCardCount: document.querySelectorAll(".font-card").length,
      text: poster.textContent.replace(/\s+/g, " ").trim(),
      bounds,
      fonts: {
        dela: document.fonts.check('49px "Dela Gothic One"', "リスナー投票"),
        blackOps: document.fonts.check('54px "Black Ops One"', "ROUND 1"),
        noto: document.fonts.check('17px "Noto Sans JP"', "軍用ステンシル系"),
      },
    };
  });

  assert.deepEqual(state.poster, { width: 1600, height: 900 });
  assert.deepEqual(state.scroll, { width: 1600, height: 900 });
  assert.equal(state.digitCount, 8);
  assert.equal(state.cellCount, 4);
  assert.equal(state.fontCardCount, 2);
  assert.ok(!state.text.includes("UFC"), "UFCの記載は画像に入れない");
  assert.ok(state.text.includes("軍用ステンシル系"));
  assert.deepEqual(state.fonts, { dela: true, blackOps: true, noto: true });
  for (const [selector, rect] of Object.entries(state.bounds)) {
    assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= 1600 && rect.bottom <= 900, `${selector} must fit the canvas`);
  }
  assert.deepEqual(errors, []);

  await page.screenshot({ path: OUTPUT_PATH });
  console.log(`verified and saved ${OUTPUT_PATH}`);
} finally {
  await browser.close();
  server.close();
}
