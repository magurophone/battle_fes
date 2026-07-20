import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import sharp from "sharp";

const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUTPUT_DIR = path.resolve("output/comparison");
const FINAL_PNG = path.join(OUTPUT_DIR, "battlefes-site-evolution.png");
const FINAL_JPG = path.join(OUTPUT_DIR, "battlefes-site-evolution-x.jpg");
const MOBILE_PREVIEW = path.join(OUTPUT_DIR, "battlefes-site-evolution-mobile-preview.png");

const stages = [
  {
    slug: "initial",
    commit: "3da9cfc",
    root: "",
    entry: "battlefes.html",
    output: path.join(OUTPUT_DIR, "stage-01-initial.png"),
  },
  {
    slug: "final",
    root: "public",
    entry: "public/index.html",
    output: path.join(OUTPUT_DIR, "stage-03-final.png"),
  },
];

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
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

function gitFile(commit, filePath) {
  const result = spawnSync("git", ["show", `${commit}:${filePath}`], {
    cwd: process.cwd(),
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

function prefixAbsolutePaths(html, slug) {
  const base = `/capture/${slug}/`;
  return html
    .replace(/((?:href|src)=['"])\/(?!\/)/g, `$1${base}`)
    .replace(/url\((['"]?)\/(?!\/)/g, `url($1${base}`)
    .replace(/(['"])\/api\//g, `$1${base}api/`);
}

async function serveFile(response, filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(".");
  if (!resolved.startsWith(root)) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const info = await stat(resolved);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentType(resolved), "cache-control": "no-store" });
    createReadStream(resolved).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname === "/comparison") {
      await serveFile(response, "promo/site-evolution-comparison.html");
      return;
    }

    const match = url.pathname.match(/^\/capture\/([^/]+)\/(.*)$/);
    if (match) {
      const [, slug, relativeRequest] = match;
      const stage = stages.find((candidate) => candidate.slug === slug);
      if (!stage) {
        response.writeHead(404);
        response.end("Unknown stage");
        return;
      }

      const relativePath = relativeRequest || "index.html";
      const sourcePath = relativePath === "index.html"
        ? stage.entry
        : path.posix.join(stage.root, relativePath.replaceAll("\\", "/"));

      if (stage.commit) {
        const body = gitFile(stage.commit, sourcePath);
        if (!body) {
          response.writeHead(404);
          response.end("Not found in historical commit");
          return;
        }
        const renderedBody = path.extname(sourcePath).toLowerCase() === ".html"
          ? Buffer.from(prefixAbsolutePaths(body.toString("utf8"), stage.slug), "utf8")
          : body;
        response.writeHead(200, {
          "content-type": contentType(sourcePath),
          "cache-control": "no-store",
        });
        response.end(renderedBody);
        return;
      }

      if (path.extname(sourcePath).toLowerCase() === ".html") {
        try {
          const body = await readFile(sourcePath, "utf8");
          response.writeHead(200, {
            "content-type": contentType(sourcePath),
            "cache-control": "no-store",
          });
          response.end(prefixAbsolutePaths(body, stage.slug));
        } catch {
          response.writeHead(404);
          response.end("Not found");
        }
        return;
      }

      await serveFile(response, sourcePath);
      return;
    }

    await serveFile(response, url.pathname.slice(1));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function waitForVisuals(page) {
  await page.evaluate(async () => {
    const timeout = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    await Promise.race([document.fonts.ready.catch(() => {}), timeout(4000)]);
    await Promise.race([
      Promise.all(Array.from(document.images, (image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })),
      timeout(4000),
    ]);
  });
}

async function captureStage(browser, baseUrl, stage) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}/capture/${stage.slug}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await waitForVisuals(page);
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition: none !important;
      }
    ` });
    const hero = page.locator("#hero");
    assert.equal(await hero.count(), 1, `${stage.slug}: #hero must exist exactly once`);
    const box = await hero.boundingBox();
    assert.ok(box && box.width >= 1200, `${stage.slug}: hero should fill the desktop viewport`);
    assert.ok(box && box.height >= 650, `${stage.slug}: hero should be tall enough for comparison`);
    await page.screenshot({
      path: stage.output,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth !== 1280) {
      console.warn(`${stage.slug}: historical page width is ${scrollWidth}px; captured at the shared 1280px frame`);
    }
    if (errors.length) console.warn(`${stage.slug}: page errors: ${errors.join(" | ")}`);
  } finally {
    await page.close();
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
const { server, port } = await startServer();
const browser = await chromium.launch(existsSync(EDGE_EXECUTABLE) ? { executablePath: EDGE_EXECUTABLE } : {});
const baseUrl = `http://127.0.0.1:${port}`;

try {
  for (const stage of stages) {
    await captureStage(browser, baseUrl, stage);
  }

  const comparison = await browser.newPage({
    viewport: { width: 2400, height: 1350 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await comparison.goto(`${baseUrl}/comparison`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await waitForVisuals(comparison);
  const stageCards = comparison.locator(".stage");
  assert.equal(await stageCards.count(), 2, "comparison must contain the initial and final stages");
  const dimensions = await comparison.evaluate(() => ({
    canvas: document.getElementById("comparison")?.getBoundingClientRect().toJSON(),
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    imageWidths: Array.from(document.images, (image) => image.naturalWidth),
  }));
  assert.equal(Math.round(dimensions.canvas.width), 2400);
  assert.equal(Math.round(dimensions.canvas.height), 1350);
  assert.equal(dimensions.scrollWidth, 2400);
  assert.equal(dimensions.scrollHeight, 1350);
  assert.ok(dimensions.imageWidths.every((width) => width > 0), "all comparison images must load");
  await comparison.screenshot({ path: FINAL_PNG });
  await comparison.close();

  await sharp(FINAL_PNG)
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(FINAL_JPG);

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await mobile.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#050714}body{display:grid;place-items:center;padding:16px}img{display:block;width:100%;height:auto;border:1px solid rgba(255,211,110,.35);box-shadow:0 18px 50px #000}
  </style><img src="${baseUrl}/output/comparison/battlefes-site-evolution-x.jpg" alt="BATTLE FES site evolution comparison">`, { waitUntil: "domcontentloaded" });
  await waitForVisuals(mobile);
  const mobileState = await mobile.evaluate(() => ({
    width: document.images[0].naturalWidth,
    height: document.images[0].naturalHeight,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  assert.deepEqual([mobileState.width, mobileState.height], [2400, 1350]);
  assert.equal(mobileState.scrollWidth, mobileState.viewportWidth, "mobile preview must not overflow");
  await mobile.screenshot({ path: MOBILE_PREVIEW, fullPage: true });
  await mobile.close();

  const [pngInfo, jpgInfo] = await Promise.all([
    sharp(FINAL_PNG).metadata(),
    sharp(FINAL_JPG).metadata(),
  ]);
  assert.deepEqual([pngInfo.width, pngInfo.height], [2400, 1350]);
  assert.deepEqual([jpgInfo.width, jpgInfo.height], [2400, 1350]);
  console.log(JSON.stringify({
    finalPng: path.relative(process.cwd(), FINAL_PNG),
    finalJpg: path.relative(process.cwd(), FINAL_JPG),
    mobilePreview: path.relative(process.cwd(), MOBILE_PREVIEW),
    dimensions: `${pngInfo.width}x${pngInfo.height}`,
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
