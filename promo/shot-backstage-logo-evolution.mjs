import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const outputPath = path.join(projectRoot, "public", "assets", "promo", "backstage-5-logo-evolution.png");

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const filePath = path.resolve(projectRoot, `.${decodedPath}`);
    if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("Not a file");
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

const { server, port } = await startStaticServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const page = await browser.newPage({
  viewport: { width: 2048, height: 1152 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.goto(`http://127.0.0.1:${port}/promo/backstage-logo-evolution.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const verification = await page.locator("main.page").evaluate((element) => {
    const imageOverflow = Array.from(element.querySelectorAll(".card")).flatMap((card, index) => {
      const cardBounds = card.getBoundingClientRect();
      const imageBounds = card.querySelector("img").getBoundingClientRect();
      const fits = imageBounds.left >= cardBounds.left
        && imageBounds.top >= cardBounds.top
        && imageBounds.right <= cardBounds.right
        && imageBounds.bottom <= cardBounds.bottom;
      return fits ? [] : [{ index: index + 1, cardBounds, imageBounds }];
    });
    return {
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      logoCount: element.querySelectorAll(".card img").length,
      finalCount: element.querySelectorAll(".card.final").length,
      loadedLogoCount: Array.from(element.querySelectorAll(".card img"))
        .filter((image) => image.complete && image.naturalWidth > 0).length,
      imageOverflow,
    };
  });

  if (verification.width !== 2048 || verification.height !== 1152) {
    throw new Error(`Unexpected canvas size: ${verification.width}x${verification.height}`);
  }
  if (verification.logoCount !== 8 || verification.loadedLogoCount !== 8 || verification.finalCount !== 1) {
    throw new Error(`Unexpected logo layout: ${JSON.stringify(verification)}`);
  }
  if (verification.imageOverflow.length > 0) {
    throw new Error(`At least one logo extends beyond its comparison card: ${JSON.stringify(verification.imageOverflow)}`);
  }
  if (errors.length > 0) {
    throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
  }

  await page.locator("main.page").screenshot({ path: outputPath });
  console.log(JSON.stringify({ outputPath, ...verification }, null, 2));
} finally {
  await browser.close();
  server.close();
}
