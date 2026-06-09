import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const root = path.resolve("public");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.resolve(root, relative);
    if (!filePath.startsWith(root)) { response.writeHead(403); response.end("Forbidden"); return; }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise((d) => server.close(d)) });
    });
  });
}

const server = await startStaticServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${server.baseUrl}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // Report visibility of the toggled blocks
  const vis = await page.evaluate(() => {
    const rules = document.querySelector(".about-rules");
    const sched = document.querySelector("#schedule");
    const navLink = document.querySelector('.nav-drawer a[href="#schedule"]');
    const seen = (el) => !!el && el.offsetParent !== null;
    return {
      aboutRulesVisible: seen(rules),
      scheduleVisible: seen(sched),
      scheduleNavVisible: seen(navLink),
      sections: [...document.querySelectorAll("section[id], div[id]")]
        .map((e) => e.id).filter(Boolean),
    };
  });
  await page.evaluate(() => {
    const el = document.querySelector("#teams");
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(600);
  const entry = await page.evaluate(() => {
    const er = document.querySelector(".entry-reg");
    return { entryRegVisible: !!er && er.offsetParent !== null };
  });
  await page.locator("#teams").screenshot({ path: "shot-teams.png" });
  const hero = await page.evaluate(() => {
    const btns = document.querySelector(".hero-btns");
    const time = document.querySelector(".date-online-time");
    const seen = (el) => !!el && el.offsetParent !== null;
    return {
      heroBtnsVisible: seen(btns),
      startTimeText: time ? time.textContent : null,
      startTimeVisible: seen(time),
    };
  });
  console.log(JSON.stringify({ ...vis, ...hero, ...entry }, null, 2));

  // 検証用: 非表示ブロックを一時的に表示してスケジュール/ルールの時刻を確認
  const times = await page.evaluate(() => {
    document.querySelectorAll("[hidden]").forEach((el) => el.removeAttribute("hidden"));
    const txt = (sel) => (document.querySelector(sel)?.textContent || "").trim();
    const sched = [...document.querySelectorAll("#schedule .schedule-item")]
      .map((it) => it.textContent.replace(/\s+/g, " ").trim())
      .filter((t) => /22:/.test(t));
    return {
      duration: txt(".about-stats .stat-card:nth-child(3) .stat-num"),
      schedTail: sched,
      voteReception: txt(".ar-rounds .ar-round:nth-child(1) .ar-rbody"),
      mainVoteHint: txt(".ar-rhint"),
    };
  });
  console.log(JSON.stringify(times, null, 2));
  await page.evaluate(() => document.querySelector("#schedule")?.scrollIntoView());
  await page.waitForTimeout(400);
  await page.locator("#schedule").screenshot({ path: "shot-schedule.png" });
  await page.locator("#hero").screenshot({ path: "shot-hero.png" });
  await page.locator(".hero-date").screenshot({ path: "shot-hero-date.png" });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  await mpage.goto(`${server.baseUrl}/index.html`, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(800);
  await mpage.locator(".hero-date").screenshot({ path: "shot-hero-date-mobile.png" });
  await mpage.evaluate(() => document.querySelector("#teams")?.scrollIntoView());
  await mpage.waitForTimeout(700);
  await mpage.locator("#teams .team-card").first().screenshot({ path: "shot-card-mobile.png" });
  await mobile.close();
  await page.screenshot({ path: "shot-stage-hide-full.png", fullPage: true });
  console.log("screenshot saved");
} finally {
  await browser.close();
  await server.close();
}
