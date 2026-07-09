import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

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
      response.writeHead(404); response.end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

const { server, port } = await startStaticServer();
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

for (const [query, out] of [["", "promo/poster-with-text.png"], ["?notext=1", "promo/poster-no-text.png"]]) {
  await page.goto(`http://127.0.0.1:${port}/promo/poster.html${query}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  console.log("saved", out);
}

await browser.close();
server.close();
