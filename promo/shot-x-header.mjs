import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const WIDTH = 1500;
const HEIGHT = 500;
const SCALE = 2;
const OUTPUT_PNG = "public/assets/promo/x-header-battle-fes.png";
const OUTPUT_JPG = "public/assets/promo/x-header-battle-fes-upload.jpg";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
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
    const filePath = url.pathname.startsWith("/promo/")
      ? path.resolve(promoRoot, url.pathname.slice("/promo/".length))
      : path.resolve(publicRoot, url.pathname.slice(1));
    const allowedRoot = url.pathname.startsWith("/promo/") ? promoRoot : publicRoot;
    if (!filePath.startsWith(allowedRoot)) {
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

await mkdir(path.dirname(OUTPUT_PNG), { recursive: true });
const { server, port } = await startStaticServer();
let browser;
try {
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ executablePath: EDGE });
  }
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/promo/x-header.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0)
  );
  const state = await page.evaluate(() => {
    const root = document.querySelector(".header");
    const info = document.querySelector(".info");
    const brand = document.querySelector(".brand");
    return {
      root: root.getBoundingClientRect().toJSON(),
      info: info.getBoundingClientRect().toJSON(),
      brand: brand.getBoundingClientRect().toJSON(),
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      imageCount: document.images.length,
    };
  });
  assert.equal(state.root.width, WIDTH);
  assert.equal(state.root.height, HEIGHT);
  assert.equal(state.documentWidth, WIDTH);
  assert.equal(state.documentHeight, HEIGHT);
  assert.equal(state.imageCount, 5);
  assert.ok(state.brand.left >= 200 && state.brand.right < 650);
  assert.ok(state.info.left >= 650 && state.info.right <= 1420);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: OUTPUT_PNG });
  await sharp(OUTPUT_PNG)
    .flatten({ background: "#050917" })
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", progressive: true, optimiseCoding: true })
    .toFile(OUTPUT_JPG);
  const [pngMeta, jpgMeta] = await Promise.all([
    sharp(OUTPUT_PNG).metadata(),
    sharp(OUTPUT_JPG).metadata(),
  ]);
  assert.equal(pngMeta.width, WIDTH * SCALE);
  assert.equal(pngMeta.height, HEIGHT * SCALE);
  assert.equal(jpgMeta.width, WIDTH * SCALE);
  assert.equal(jpgMeta.height, HEIGHT * SCALE);
  console.log(`saved ${OUTPUT_PNG} (${pngMeta.width}x${pngMeta.height})`);
  console.log(`saved ${OUTPUT_JPG} (${jpgMeta.width}x${jpgMeta.height}, 4:4:4)`);
} finally {
  if (browser) await browser.close();
  server.close();
}
