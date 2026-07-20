import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUTPUT_PATH = "public/assets/promo/backstage-6-aggregation.png";
const FORBIDDEN_VISIBLE_TEXT = ["個人賞", "個人賞加点", "MVP", "最優秀エンタメ賞", "ベストモーメント賞"];

const teams = [
  { id: 1, name: "CRIMSON" },
  { id: 2, name: "NOVA" },
  { id: 3, name: "GOLDEN" },
];

const members = [
  { id: 1, teamId: 1, name: "Member 01" },
  { id: 2, teamId: 1, name: "Member 02" },
  { id: 3, teamId: 1, name: "Member 03" },
  { id: 4, teamId: 2, name: "Member 04" },
  { id: 5, teamId: 2, name: "Member 05" },
  { id: 6, teamId: 2, name: "Member 06" },
  { id: 7, teamId: 3, name: "Member 07" },
  { id: 8, teamId: 3, name: "Member 08" },
  { id: 9, teamId: 3, name: "Member 09" },
];

const mockAdminResponse = {
  ok: true,
  status: "open",
  access: {
    role: "owner",
    canViewResults: true,
    canManageVotes: true,
    canEditLiveScores: true,
    resultsUnlockAt: "2026-07-18T22:50:00+09:00",
  },
  config: {
    categories: [{
      id: "team",
      type: "team",
      label: "優勝チーム投票",
      candidateType: "team",
      candidateIds: [1, 2, 3],
    }],
    teams,
    members,
  },
  categories: {
    team: {
      results: {
        counts: { 1: 84, 2: 76, 3: 79 },
        points: { 1: 218400, 2: 206800, 3: 211200 },
        totalVotes: 239,
        totalPoints: 636400,
        updatedAt: "2026-07-18T13:14:08.000Z",
      },
      meta: {
        totalSubmissions: 239,
        lastVoteAt: "2026-07-18T13:14:08.000Z",
      },
      uniqueFingerprints: 239,
      voteLog: [],
    },
  },
  eventImpressions: [],
  liveScores: {
    memberScores: {},
    teamScores: { 1: 148200, 2: 151600, 3: 146900 },
    totalLiveScore: 446700,
    updatedAt: "2026-07-18T13:13:30.000Z",
  },
  individualAwardBonuses: {
    pointPerAward: 0,
    teamScores: { 1: 0, 2: 0, 3: 0 },
    totalPoints: 0,
    awards: [],
  },
  finalResults: null,
  adminVoteStatusOverride: null,
};

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startStaticServer() {
  const publicRoot = path.resolve("public");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const filePath = path.resolve(publicRoot, decodeURIComponent(url.pathname.slice(1)));
    if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
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

await mkdir("public/assets/promo", { recursive: true });
const { server, port } = await startStaticServer();
const browser = await chromium.launch(existsSync(EDGE_EXECUTABLE) ? { executablePath: EDGE_EXECUTABLE } : {});
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

try {
  await page.route("**/api/admin/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(mockAdminResponse),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("battlefes_admin_token", "demo-screenshot-token");
  });
  await page.goto(`http://127.0.0.1:${port}/admin/index.html`, { waitUntil: "networkidle" });
  await page.locator("#dashboard:not(.hidden)").waitFor();
  await page.locator("#overallCategoryWrap .category-block").waitFor();

  await page.evaluate(() => {
    document.querySelector('[data-admin-tab="individual"]')?.remove();
    document.querySelector('[data-admin-tab-panel="individual"]')?.remove();
    document.getElementById("accessBar")?.remove();
    document.querySelector('[data-admin-tab="settings"]')?.remove();
    document.querySelector('[data-admin-tab-panel="settings"]')?.remove();

    const resultTable = document.querySelector("#overallCategoryWrap .detail-section table");
    resultTable?.querySelectorAll("tr").forEach((row) => {
      row.children[2]?.remove();
    });

    document.querySelectorAll("#overallCategoryWrap .meta-grid > div").forEach((item) => {
      if (item.textContent.includes("個人賞")) item.remove();
    });

    const demoBadge = document.createElement("div");
    demoBadge.id = "demoDataBadge";
    demoBadge.innerHTML = "<b>DEMO DATA</b><span>画面掲載用のダミー数値です</span>";
    document.querySelector(".hero")?.appendChild(demoBadge);

    const style = document.createElement("style");
    style.textContent = `
      body {
        min-width: 1180px;
        background:
          radial-gradient(900px 420px at 78% -10%, rgba(255, 103, 20, .15), transparent 60%),
          radial-gradient(760px 380px at 8% 104%, rgba(121, 31, 78, .16), transparent 62%),
          #080912;
      }
      .shell { width: min(1420px, calc(100% - 64px)); max-width: none; margin: 0 auto; padding-top: 28px; }
      .hero { position: relative; padding: 26px 32px; text-align: left; }
      .hero h1 { margin: 0; font-size: 2.55rem; letter-spacing: .09em; }
      .hero .subtitle { max-width: 780px; margin-top: 7px; font-size: .92rem; }
      #demoDataBadge {
        position: absolute;
        top: 50%;
        right: 30px;
        display: grid;
        gap: 5px;
        min-width: 270px;
        padding: 13px 18px;
        transform: translateY(-50%);
        border: 1px solid rgba(255, 216, 39, .55);
        border-radius: 10px;
        background: rgba(255, 216, 39, .075);
        text-align: left;
      }
      #demoDataBadge b { color: #ffd827; font-family: ui-monospace, Consolas, monospace; font-size: .92rem; letter-spacing: .13em; }
      #demoDataBadge span { color: rgba(255, 248, 238, .72); font-size: .75rem; font-weight: 700; }
      #statusText { display: none; }
      .admin-tabs { margin-top: 18px; }
      .admin-tabs button { padding: .72rem 1.65rem; }
      [data-admin-tab="logs"], [data-admin-tab="input"] { opacity: .72; }
      .stats-row { margin-top: 16px; }
      .stat-card { min-height: 76px; padding: 16px 20px; }
      .category-block { margin-top: 16px; padding: 22px 24px 24px; }
      .category-block > h3 { margin-bottom: 14px; }
      .leader-strip { margin-bottom: 14px; }
      .summary-section { padding: 15px 17px; }
      .category-block .aggregate-section { margin-top: 14px; }
      .category-block .detail-section { margin-top: 14px; }
      .meta-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
      .meta-grid > div { min-width: 0; font-size: .82rem; }
      .detail-section table { table-layout: fixed; }
      .detail-section th, .detail-section td { padding: 10px 12px; font-size: .84rem; }
      .detail-section th:first-child, .detail-section td:first-child { width: 22%; }
      .panel, .category-block, .summary-section, .stat-card { box-shadow: 0 12px 34px rgba(0, 0, 0, .22); }
    `;
    document.head.appendChild(style);
    window.scrollTo(0, 0);
  });

  const verification = await page.evaluate(() => {
    const visibleText = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .filter((element) => element.children.length === 0)
      .map((element) => element.textContent.trim())
      .filter(Boolean)
      .join(" ");
    const resultTable = document.querySelector("#overallCategoryWrap .detail-section table");
    return {
      visibleText,
      tableColumnCount: resultTable?.querySelector("thead tr")?.children.length || 0,
      teamRowCount: resultTable?.querySelectorAll("tbody tr").length || 0,
      demoBadgeVisible: Boolean(document.querySelector("#demoDataBadge")?.getBoundingClientRect().width),
      dashboardVisible: !document.getElementById("dashboard").classList.contains("hidden"),
      canvas: { width: window.innerWidth, height: window.innerHeight },
      scrollTop: window.scrollY,
    };
  });

  assert.deepEqual(verification.canvas, { width: 1600, height: 900 });
  assert.equal(verification.dashboardVisible, true);
  assert.equal(verification.demoBadgeVisible, true);
  assert.equal(verification.tableColumnCount, 6);
  assert.equal(verification.teamRowCount, 3);
  assert.equal(verification.scrollTop, 0);
  assert.ok(verification.visibleText.includes("DEMO DATA"));
  assert.ok(verification.visibleText.includes("CRIMSON"));
  assert.ok(verification.visibleText.includes("NOVA"));
  assert.ok(verification.visibleText.includes("GOLDEN"));
  for (const forbidden of FORBIDDEN_VISIBLE_TEXT) {
    assert.ok(!verification.visibleText.includes(forbidden), `公開画像に非公開語「${forbidden}」を含めない`);
  }
  assert.deepEqual(browserErrors, []);

  await page.screenshot({ path: OUTPUT_PATH });
  console.log(`verified and saved ${OUTPUT_PATH}`);
} finally {
  await browser.close();
  server.close();
}
