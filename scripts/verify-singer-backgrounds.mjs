import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const OUTPUT_DIR = path.join(ROOT, "output", "review", "singer-backgrounds");
const IMAGES = [
  ["insight", "背景/insight_貫通BONUS_9-9.png"],
  ["66-route", "背景/66号線_貫通BONUS_9-9.png"],
  ["rocknroll", "背景/ロックンロールイズノットデッド_貫通BONUS_9-9.png"],
];

const contentType = (filePath) =>
  ({
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
  })[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (url.pathname === "/preview") {
    const image = url.searchParams.get("image") ?? "";
    response.writeHead(200, { "content-type": contentType("preview.html") });
    response.end(`<!doctype html>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; background: #111; }
        .room { position: relative; width: 100vw; overflow: hidden; }
        .room > img { display: block; width: 100%; height: auto; }
        .guide { position: absolute; left: 0; right: 0; color: #fff; font: 700 12px sans-serif; text-align: center; }
        .top { top: 0; height: 15.5%; border-bottom: 2px solid #43d9ff; background: rgba(0, 25, 40, .12); }
        .top::after { content: "上部UI予約領域"; position: absolute; bottom: 5px; left: 0; right: 0; }
        .lyrics { top: 57%; height: 4%; border-block: 2px solid #ff4d91; background: rgba(70, 0, 25, .18); display: grid; place-items: center; }
        .lyrics::after { content: "歌詞帯"; }
        .comments { top: 61%; bottom: 0; border-top: 1px dashed rgba(255,255,255,.8); }
        .comments::after { content: "コメント欄"; position: absolute; top: 12px; left: 0; right: 0; }
      </style>
      <div class="room">
        <img id="background" src="/${encodeURI(image)}" alt="">
        <div class="guide top"></div>
        <div class="guide lyrics"></div>
        <div class="guide comments"></div>
      </div>`);
    return;
  }

  const relativePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await mkdir(OUTPUT_DIR, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  for (const [slug, image] of IMAGES) {
    await page.goto(
      `http://127.0.0.1:${port}/preview?image=${encodeURIComponent(image)}`,
      { waitUntil: "networkidle" },
    );
    await page.locator("#background").evaluate(async (img) => {
      if (!img.complete) await new Promise((resolve) => img.addEventListener("load", resolve, { once: true }));
      await img.decode();
    });
    const naturalSize = await page.locator("#background").evaluate((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
    if (!naturalSize.width || !naturalSize.height) {
      throw new Error(`Image failed to load: ${image}`);
    }
    await page.locator(".room").screenshot({
      path: path.join(OUTPUT_DIR, `${slug}-mobile-guides.png`),
    });
    console.log(`${slug}: ${naturalSize.width}x${naturalSize.height} PASS`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
