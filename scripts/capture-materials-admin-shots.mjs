import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ADMIN_TOKEN = "materials-sample-token";
const OUTPUT_DIR = path.resolve("public/materials/images");

const teams = [
  { id: 1, name: "CRIMSON" },
  { id: 2, name: "NOVA" },
  { id: 3, name: "GOLDEN" },
];

const members = [
  { id: 1, teamId: 1, name: "CRIMSON メンバー1" },
  { id: 2, teamId: 1, name: "CRIMSON メンバー2" },
  { id: 3, teamId: 1, name: "まぐろふぉん" },
  { id: 4, teamId: 2, name: "NOVA メンバー1" },
  { id: 5, teamId: 2, name: "NOVA メンバー2" },
  { id: 6, teamId: 2, name: "りんか" },
  { id: 7, teamId: 3, name: "GOLDEN メンバー1" },
  { id: 8, teamId: 3, name: "GOLDEN メンバー2" },
  { id: 9, teamId: 3, name: "iran痔" },
];

const memberIds = members.map((member) => member.id);
const categories = [
  { id: "team", type: "team", label: "優勝チーム投票", candidateType: "team", candidateIds: [1, 2, 3] },
  { id: "mvp", type: "individual", label: "MVP（最優秀歌唱賞）", candidateType: "member", candidateIds: memberIds },
  { id: "entertainer", type: "individual", label: "最優秀エンタメ賞", candidateType: "member", candidateIds: memberIds },
  { id: "moment", type: "individual", label: "ベストモーメント賞", candidateType: "member", candidateIds: memberIds },
];

function emptyResults(candidateIds) {
  return {
    counts: Object.fromEntries(candidateIds.map((id) => [id, 0])),
    points: Object.fromEntries(candidateIds.map((id) => [id, 0])),
    totalVotes: 0,
    totalPoints: 0,
    bonusCount: 0,
    updatedAt: null,
  };
}

function adminResults(category) {
  const result = emptyResults(category.candidateIds);
  result.updatedAt = "2026-07-18T13:24:00.000Z";

  if (category.id === "team") {
    result.counts = { 1: 54, 2: 43, 3: 31 };
    result.points = { 1: 218000, 2: 196000, 3: 171000 };
    result.totalVotes = 128;
    result.totalPoints = 585000;
    result.bonusCount = 26;
  } else if (category.id === "mvp") {
    result.counts = { ...result.counts, 3: 32, 6: 27, 9: 24, 4: 18, 1: 11 };
    result.totalVotes = 112;
  } else if (category.id === "entertainer") {
    result.counts = { ...result.counts, 5: 30, 8: 26, 2: 22, 7: 17, 4: 13 };
    result.totalVotes = 108;
  } else if (category.id === "moment") {
    result.counts = { ...result.counts, 1: 29, 7: 25, 6: 21, 3: 18, 9: 13 };
    result.totalVotes = 106;
  }
  return result;
}

function voteLogFor(category) {
  const base = [
    {
      candidateId: 1,
      voterName: "Listener A",
      timestamp: "2026-07-18T13:23:00.000Z",
      votePoint: 5000,
      bonusPoint: 5000,
      bonusKeywordSubmitted: "GLORIA",
      bonusKeywordMatched: true,
      comment: "",
    },
    {
      candidateId: 2,
      voterName: "Listener B",
      timestamp: "2026-07-18T13:21:00.000Z",
      votePoint: 4870,
      bonusPoint: 0,
      bonusKeywordSubmitted: "GL0RIA",
      bonusKeywordMatched: false,
      comment: "",
    },
    {
      candidateId: 3,
      voterName: "Listener C",
      timestamp: "2026-07-18T13:18:00.000Z",
      votePoint: 4720,
      bonusPoint: 0,
      bonusKeywordSubmitted: "",
      bonusKeywordMatched: false,
      comment: "",
    },
  ];

  if (category.id === "team") return base.map((entry) => ({ ...entry, categoryId: "team" }));
  if (category.id === "mvp") {
    return [
      {
        categoryId: "mvp",
        candidateId: 3,
        voterName: "Listener D",
        comment: "最後のサビの伸びが圧倒的でした。",
        timestamp: "2026-07-18T13:24:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
      {
        categoryId: "mvp",
        candidateId: 6,
        voterName: "Listener E",
        comment: "高音と表現の切り替えが印象に残りました。",
        timestamp: "2026-07-18T13:22:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
    ];
  }
  if (category.id === "entertainer") {
    return [
      {
        categoryId: "entertainer",
        candidateId: 5,
        voterName: "Listener F",
        comment: "会場の空気を一気に持っていった感じがしました。",
        timestamp: "2026-07-18T13:20:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
    ];
  }
  if (category.id === "moment") {
    return [
      {
        categoryId: "moment",
        candidateId: 1,
        voterName: "Listener G",
        comment: "イントロから引き込まれました。",
        timestamp: "2026-07-18T13:19:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
    ];
  }
  return [];
}

function liveScoreEntry(memberId, teamId, oshiBonusPercent, monthlyOshiPointInFrame) {
  const liveScore = Math.round((Number(monthlyOshiPointInFrame) / (1 + Number(oshiBonusPercent) / 100)) / 100) * 100;
  return { memberId, teamId, oshiBonusPercent, monthlyOshiPointInFrame, liveScore };
}

function adminPayload() {
  const memberScoreRows = [
    liveScoreEntry(1, 1, 20, 2400),
    liveScoreEntry(2, 1, 15, 2300),
    liveScoreEntry(3, 1, 30, 3900),
    liveScoreEntry(4, 2, 10, 2200),
    liveScoreEntry(5, 2, 25, 2500),
    liveScoreEntry(6, 2, 20, 3000),
    liveScoreEntry(7, 3, 12, 2200),
    liveScoreEntry(8, 3, 18, 2600),
    liveScoreEntry(9, 3, 28, 3200),
  ];
  const teamScores = Object.fromEntries(teams.map((team) => [team.id, 0]));
  memberScoreRows.forEach((entry) => {
    teamScores[entry.teamId] += entry.liveScore;
  });
  const totalLiveScore = Object.values(teamScores).reduce((sum, score) => sum + score, 0);

  return {
    ok: true,
    status: "closed",
    config: { categories, teams, members },
    categories: Object.fromEntries(
      categories.map((category) => [
        category.id,
        {
          results: adminResults(category),
          meta: {
            totalSubmissions: adminResults(category).totalVotes,
            lastVoteAt: adminResults(category).updatedAt,
          },
          voteLog: voteLogFor(category),
          uniqueFingerprints: category.id === "team" ? 128 : adminResults(category).totalVotes,
        },
      ])
    ),
    eventImpressions: [
      {
        voterName: "Listener H",
        comment: "チームごとの色がはっきり出ていて楽しかったです。",
        timestamp: "2026-07-18T13:25:00.000Z",
      },
      {
        voterName: "Listener I",
        comment: "最後まで接戦で、投票する側もかなり迷いました。",
        timestamp: "2026-07-18T13:24:00.000Z",
      },
    ],
    liveScores: {
      memberScores: Object.fromEntries(memberScoreRows.map((entry) => [entry.memberId, entry])),
      teamScores,
      totalLiveScore,
    },
  };
}

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
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function capture(locator, fileName) {
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({ path: path.join(OUTPUT_DIR, fileName) });
  console.log(`saved ${fileName}`);
}

await mkdir(OUTPUT_DIR, { recursive: true });

const server = await startStaticServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_admin_token", token);
  }, ADMIN_TOKEN);
  const page = await context.newPage();

  await page.route("**/api/admin/results", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload()),
    });
  });
  await page.route("**/api/admin/live-scores", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload()),
    });
  });

  await page.goto(`${server.baseUrl}/admin/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.getElementById("dashboard").classList.contains("hidden"));
  await page.addStyleTag({
    content: `
      .admin-tabs { position: static !important; top: auto !important; }
      html, body { background: #0b1020 !important; }
      body { padding-top: 12px !important; }
      * { animation: none !important; transition: none !important; }
    `,
  });

  await capture(page.locator('[data-admin-tab-panel="overall"]'), "admin-overall.png");

  await page.evaluate(() => activateAdminTab("input"));
  await page.waitForFunction(() => document.querySelector('[data-admin-tab-panel="input"]')?.classList.contains("is-active"));
  await page.locator("#liveScoreDetails").evaluate((node) => { node.open = true; });
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-admin-tab-panel="input"]');
    const card = document.querySelector("#liveScoreInputs .live-score-card");
    return panel && card && getComputedStyle(panel).display !== "none";
  });
  await capture(page.locator(".live-score-panel"), "admin-input.png");

  await page.evaluate(() => activateAdminTab("logs"));
  await page.waitForFunction(() => document.querySelector('[data-admin-tab-panel="logs"]')?.classList.contains("is-active"));
  await page.evaluate(() => activateCommentLogTab("awards"));
  await page.waitForFunction(() => document.querySelector('[data-comment-log-panel="awards"]')?.classList.contains("is-active"));
  await capture(page.locator('[data-comment-log-panel="awards"] .panel'), "admin-award-comments.png");

  await page.evaluate(() => activateCommentLogTab("audit"));
  await page.waitForFunction(() => document.querySelector('[data-comment-log-panel="audit"]')?.classList.contains("is-active"));
  await capture(page.locator("#operationVoteLogPanel"), "admin-vote-log.png");
} finally {
  await browser.close();
  await server.close();
}
