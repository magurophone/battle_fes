import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUTPUT_PATH = "public/assets/promo/eve-talk-7-17.png";
const MOBILE_REVIEW_PATH = "output/review/eve-talk-mobile-preview.png";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
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
      if (!filePath.startsWith(promoRoot)) {
        response.writeHead(403);
        response.end();
        return;
      }
    } else {
      filePath = path.resolve(publicRoot, url.pathname.slice(1));
      if (!filePath.startsWith(publicRoot)) {
        response.writeHead(403);
        response.end();
        return;
      }
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

async function waitForVisuals(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", () => reject(new Error(`image failed: ${img.currentSrc || img.src}`)), { once: true });
      });
    }));
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

await mkdir("public/assets/promo", { recursive: true });
await mkdir("output/review", { recursive: true });
const { server, port } = await startStaticServer();
const browser = await chromium.launch(existsSync(EDGE_EXECUTABLE) ? { executablePath: EDGE_EXECUTABLE } : {});

try {
  const desktop = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const desktopErrors = watchErrors(desktop);
  await desktop.goto(`http://127.0.0.1:${port}/promo/eve-talk.html`, { waitUntil: "networkidle" });
  await waitForVisuals(desktop);

  const desktopState = await desktop.evaluate(() => {
    const canvas = document.querySelector(".poster").getBoundingClientRect();
    const targets = [".topline", ".headline", ".leader-grid", ".broadcast"];
    const bounds = Object.fromEntries(targets.map((selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
    }));
    return {
      canvas: { width: canvas.width, height: canvas.height, left: canvas.left, top: canvas.top },
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      leaderCount: document.querySelectorAll(".leader-card").length,
      portraitCount: document.querySelectorAll(".portrait-frame img").length,
      portraitShape: (() => {
        const style = getComputedStyle(document.querySelector(".portrait-frame"));
        return { borderRadius: style.borderRadius, clipPath: style.clipPath };
      })(),
      text: document.querySelector(".poster").textContent.replace(/\s+/g, " ").trim(),
      officialImagesOnly: Array.from(document.images).every((img) => img.getAttribute("src")?.startsWith("/assets/") || img.getAttribute("src") === "/hero-bg.webp"),
      imageSizes: Array.from(document.images).map((img) => ({ src: img.getAttribute("src"), width: img.naturalWidth, height: img.naturalHeight })),
      bounds,
      fonts: {
        blackOps: document.fonts.check('96px "Black Ops One Local"', "23:00"),
        dela: document.fonts.check('94px "Dela Gothic One"', "前夜対談"),
        noto: document.fonts.check('31px "Noto Sans JP"', "まぐろふぉん"),
      },
    };
  });

  assert.deepEqual(desktopState.canvas, { width: 1600, height: 900, left: 0, top: 0 });
  assert.deepEqual(desktopState.viewport, { width: 1600, height: 900 });
  assert.deepEqual(desktopState.scroll, { width: 1600, height: 900 });
  assert.equal(desktopState.leaderCount, 3);
  assert.equal(desktopState.portraitCount, 3);
  assert.equal(desktopState.portraitShape.borderRadius, "0px");
  assert.notEqual(desktopState.portraitShape.clipPath, "none");
  assert.equal(desktopState.officialImagesOnly, true);
  assert.ok(desktopState.imageSizes.every((image) => image.width > 0 && image.height > 0), "all official images must load");
  assert.ok(desktopState.text.includes("前夜対談"));
  assert.ok(desktopState.text.includes("23:00"));
  assert.ok(desktopState.text.includes("START"));
  assert.ok(desktopState.text.includes("iran痔"));
  assert.ok(desktopState.text.includes("まぐろふぉん"));
  assert.ok(desktopState.text.includes("りんか"));
  assert.deepEqual(desktopState.fonts, { blackOps: true, dela: true, noto: true });
  for (const [selector, rect] of Object.entries(desktopState.bounds)) {
    assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= 1600 && rect.bottom <= 900, `${selector} must fit the desktop canvas`);
  }
  assert.deepEqual(desktopErrors, []);
  await desktop.screenshot({ path: OUTPUT_PATH });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobileErrors = watchErrors(mobile);
  await mobile.goto(`http://127.0.0.1:${port}/promo/eve-talk.html`, { waitUntil: "networkidle" });
  await waitForVisuals(mobile);

  const mobileState = await mobile.evaluate(() => {
    const shell = document.querySelector(".preview-shell").getBoundingClientRect();
    const poster = document.querySelector(".poster").getBoundingClientRect();
    return {
      shell: { width: shell.width, height: shell.height, left: shell.left, top: shell.top },
      poster: { width: poster.width, height: poster.height, left: poster.left, top: poster.top },
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  assert.deepEqual(mobileState.viewport, { width: 390, height: 844 });
  assert.ok(mobileState.poster.width <= 390.01 && mobileState.poster.height <= 844.01, "poster must scale into mobile viewport");
  assert.ok(mobileState.poster.left >= -0.01 && mobileState.poster.top >= -0.01, "poster must remain visible on mobile");
  assert.equal(mobileState.scrollWidth, 390);
  assert.deepEqual(mobileErrors, []);
  await mobile.screenshot({ path: MOBILE_REVIEW_PATH });
  await mobile.close();

  console.log(`verified desktop and mobile; saved ${OUTPUT_PATH}`);
  console.log(`saved mobile review ${MOBILE_REVIEW_PATH}`);
} finally {
  await browser.close();
  server.close();
}
