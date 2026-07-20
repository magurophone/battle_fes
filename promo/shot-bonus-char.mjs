import { createReadStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const promoRoot = path.resolve("promo");
  const publicRoot = path.resolve("public");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    // /assets, /hero-bg.webp などは public から配信、それ以外は promo
    const isPublic = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/hero-bg");
    const root = isPublic ? publicRoot : promoRoot;
    const rel = url.pathname.replace(/^\/promo\//, "").replace(/^\//, "");
    const filePath = path.resolve(root, rel);
    if (!filePath.startsWith(root)) { response.writeHead(403); response.end(); return; }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("nf");
      response.writeHead(200, { "content-type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, port: server.address().port })));
}

// キーワード: 真夏の夜空に響け！ (9文字 = 配信者9名)
const KEYWORD = [..."真夏の夜空に響け！"];
// 引数で対象を絞れる: node promo/shot-bonus-char.mjs 真 響  (無指定なら全部)
const pick = process.argv.slice(2);
const targets = pick.length ? pick : KEYWORD;

async function applyRoundedAlpha(filePath) {
  const meta = await sharp(filePath).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error(`Invalid image: ${filePath}`);

  // CSS側の 18px radius を deviceScaleFactor 2 の出力に合わせる。
  const radius = Math.round(Math.min(width, height) * (18 / 640));
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/>
    </svg>
  `);
  const tmpPath = `${filePath}.tmp`;

  await sharp(filePath)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(tmpPath);
  await rename(tmpPath, filePath);
}

await mkdir("public/assets/promo/bonus", { recursive: true });
const { server, port } = await startStaticServer();
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 2 });

try {
  for (const ch of targets) {
    const idx = KEYWORD.indexOf(ch) + 1;
    const total = KEYWORD.length;
    const q = `ch=${encodeURIComponent(ch)}&idx=${idx}&total=${total}`;
    // 不透明版（本番用・ブランド背景入り）
    await page.goto(`http://127.0.0.1:${port}/promo/bonus-char.html?${q}&solid=1`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const out = `public/assets/promo/bonus/char-${idx}.png`;
    await page.screenshot({ path: out, omitBackground: true });
    await applyRoundedAlpha(out);
    // ギャラリー用にも同じ絵を流用
    await sharp(out)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(`public/assets/promo/bonus/preview-${idx}.png`);
    console.log("saved", out, `(${ch} ${idx}/${total})`);
    // 透過版（チーム配信背景に直接載せる用。枠なし・スクリム強化）
    await page.goto(`http://127.0.0.1:${port}/promo/bonus-char.html?${q}&trans=1`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const outTrans = `public/assets/promo/bonus/char-${idx}-trans.png`;
    await page.screenshot({ path: outTrans, omitBackground: true });
    console.log("saved", outTrans, `(${ch} ${idx}/${total})`);
  }
} finally {
  await browser.close();
  server.close();
}
