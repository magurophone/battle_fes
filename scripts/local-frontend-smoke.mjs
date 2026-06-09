import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ADMIN_TOKEN = "local-secret";

const teams = [
  { id: 1, name: "CRIMSON" },
  { id: 2, name: "NOVA" },
  { id: 3, name: "GOLDEN" },
];

const members = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  teamId: Math.floor(index / 3) + 1,
  name: `Member ${index + 1}`,
}));

const categories = [
  { id: "team", type: "team", label: "Team", candidateType: "team", candidateIds: [1, 2, 3] },
  { id: "mvp", type: "individual", label: "MVP", candidateType: "member", candidateIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: "entertainer", type: "individual", label: "Entertainer", candidateType: "member", candidateIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: "moment", type: "individual", label: "Moment", candidateType: "member", candidateIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
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
  if (category.id === "team") {
    result.counts = { 1: 2, 2: 1, 3: 0 };
    result.points = { 1: 5200, 2: 1800, 3: 0 };
    result.totalVotes = 3;
    result.totalPoints = 7000;
    result.updatedAt = "2026-07-18T13:20:00.000Z";
  } else if (category.id === "mvp") {
    result.counts = { ...result.counts, 1: 1, 4: 3 };
    result.totalVotes = 4;
    result.updatedAt = "2026-07-18T13:20:00.000Z";
  } else if (category.id === "entertainer") {
    result.counts = { ...result.counts, 5: 2, 7: 1 };
    result.totalVotes = 3;
    result.updatedAt = "2026-07-18T13:20:00.000Z";
  } else if (category.id === "moment") {
    result.counts = { ...result.counts, 9: 1 };
    result.totalVotes = 1;
    result.updatedAt = "2026-07-18T13:20:00.000Z";
  }
  return result;
}

function adminVoteLog(category) {
  if (category.id === "team") {
    return [
      {
        categoryId: "team",
        candidateId: 1,
        voterName: "Listener A",
        comment: "",
        timestamp: "2026-07-18T13:20:00.000Z",
        votePoint: 5000,
        bonusPoint: 5000,
        bonusGranted: true,
        bonusKeywordSubmitted: "GLORIA",
        bonusKeywordMatched: true,
      },
      {
        categoryId: "team",
        candidateId: 2,
        voterName: "Listener E",
        comment: "",
        timestamp: "2026-07-18T13:16:00.000Z",
        votePoint: 4782,
        bonusPoint: 0,
        bonusGranted: false,
        bonusKeywordSubmitted: "GL0RIA",
        bonusKeywordMatched: false,
      },
    ];
  }
  if (category.id === "mvp") {
    return [
      {
        categoryId: "mvp",
        candidateId: 4,
        voterName: "Listener A",
        comment: "歌がすごく良かった",
        timestamp: "2026-07-18T13:20:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusGranted: false,
        bonusKeywordSubmitted: "GLORIA",
        bonusKeywordMatched: true,
      },
      {
        categoryId: "mvp",
        candidateId: 4,
        voterName: "Listener B",
        comment: "高音が印象的",
        timestamp: "2026-07-18T13:19:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusGranted: false,
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
        voterName: "Listener C",
        comment: "盛り上げが最高",
        timestamp: "2026-07-18T13:18:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusGranted: false,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
    ];
  }
  if (category.id === "moment") {
    return [
      {
        categoryId: "moment",
        candidateId: 9,
        voterName: "Listener D",
        comment: "",
        timestamp: "2026-07-18T13:17:00.000Z",
        votePoint: 5000,
        bonusPoint: 0,
        bonusGranted: false,
        bonusKeywordSubmitted: "",
        bonusKeywordMatched: false,
      },
    ];
  }
  return [];
}

function resultsPayload() {
  return {
    ok: true,
    status: "waiting",
    config: { categories, teams, members },
    results: Object.fromEntries(categories.map((c) => [c.id, emptyResults(c.candidateIds)])),
  };
}

function adminPayload({ status = "waiting" } = {}) {
  const liveScores = {
    memberScores: Object.fromEntries(
      members.map((member) => [
        member.id,
        {
          memberId: member.id,
          teamId: member.teamId,
          oshiBonusPercent: 0,
          monthlyOshiPointInFrame: 0,
          liveScore: 0,
        },
      ])
    ),
    teamScores: Object.fromEntries(teams.map((team) => [team.id, 0])),
    totalLiveScore: 0,
  };

  return {
    ok: true,
    status,
    config: { categories, teams, members },
    categories: Object.fromEntries(
      categories.map((c) => [
        c.id,
        {
          results: adminResults(c),
          meta: { totalSubmissions: adminResults(c).totalVotes, lastVoteAt: adminResults(c).updatedAt },
          voteLog: adminVoteLog(c),
          uniqueFingerprints: 0,
        },
      ])
    ),
    eventImpressions: [
      {
        voterName: "Listener Z",
        comment: "イベント全体が楽しかった",
        timestamp: "2026-07-18T13:21:00.000Z",
      },
    ],
    liveScores,
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
      response.writeHead(404, { "content-type": "text/plain" });
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

async function runPublicVoteSmoke(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_test_mode", "1");
    localStorage.setItem("battlefes_admin_token", token);
    localStorage.removeItem("battlefes2026_vote");
  }, ADMIN_TOKEN);
  const page = await context.newPage();
  const errors = [];
  let voteAuthHeader = "";

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/results", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(resultsPayload()),
    });
  });

  await page.route("**/api/votes", async (route) => {
    voteAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        ok: true,
        duplicate: false,
        results: resultsPayload().results,
        bonusGranted: false,
        bonusKeywordMatched: false,
      }),
    });
  });

  await page.goto(`${baseUrl}/index.html#vote`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof submitBulkVote === "function" && typeof getAdminTestVoteToken === "function");

  const votePowerState = await page.evaluate(() => {
    const realNow = Date.now;
    try {
      Date.now = () => new Date("2026-07-18T22:15:00+09:00").getTime();
      const atMainVoteStart = getVotePowerProgress();
      Date.now = () => new Date("2026-07-18T22:20:00+09:00").getTime();
      const duringMainVote = getVotePowerProgress();
      return {
        voteClose: VOTE_CLOSE,
        votePointMax: VOTE_POINT_MAX,
        atMainVoteStart,
        duringMainVote,
      };
    } finally {
      Date.now = realNow;
    }
  });
  assert.equal(votePowerState.voteClose, "2026-07-18T22:30:00+09:00");
  assert.equal(votePowerState.votePointMax, "2026-07-18T22:15:00+09:00");
  assert.equal(votePowerState.atMainVoteStart, 1);
  assert.equal(votePowerState.duringMainVote, 1);

  const state = await page.evaluate(async () => {
    selected = 1;
    modalSelections = { mvp: 1, entertainer: 4, moment: 7 };
    document.getElementById("voterName").value = "Smoke User";
    document.getElementById("eventComment").value = "Smoke comment";
    await submitBulkVote();
    return {
      token: getAdminTestVoteToken(),
      voted,
    };
  });

  assert.equal(state.token, ADMIN_TOKEN);
  assert.equal(state.voted, true);
  assert.equal(voteAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.deepEqual(errors, []);
  await context.close();
}

async function runAdminSmoke(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_admin_token", token);
  }, ADMIN_TOKEN);
  const page = await context.newPage();
  const errors = [];
  let resultsAuthHeader = "";
  let resetAuthHeader = "";

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/admin/results", (route) => {
    resultsAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: "closed" })),
    });
  });

  await page.route("**/api/admin/reset", (route) => {
    resetAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: "closed" })),
    });
  });

  await page.goto(`${baseUrl}/admin/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.getElementById("dashboard").classList.contains("hidden"));

  const desktopState = await page.evaluate(() => ({
    activeTab: document.querySelector('[data-admin-tab][aria-selected="true"]')?.getAttribute("data-admin-tab"),
    activePanel: document.querySelector(".admin-tab-panel.is-active")?.getAttribute("data-admin-tab-panel"),
    liveScoreDetailsOpen: document.getElementById("liveScoreDetails").open,
    liveScoreCardCount: document.querySelectorAll(".live-score-card").length,
    liveScoreTabsDisplay: getComputedStyle(document.getElementById("liveScoreTeamTabs")).display,
    leaderLabel: document.querySelector("#overallCategoryWrap .leader-kicker")?.textContent.trim(),
    leaderName: document.querySelector("#overallCategoryWrap .leader-name")?.textContent.trim(),
  }));
  assert.equal(desktopState.activeTab, "overall");
  assert.equal(desktopState.activePanel, "overall");
  assert.equal(desktopState.liveScoreDetailsOpen, false);
  assert.equal(desktopState.liveScoreCardCount, 9);
  assert.equal(desktopState.liveScoreTabsDisplay, "none");
  assert.equal(desktopState.leaderLabel, "WINNER");
  assert.ok(desktopState.leaderName.includes("CRIMSON"));

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("button.danger").click();
  await page.waitForFunction(() => document.getElementById("statusText").textContent.includes("リセット"));

  assert.equal(resultsAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.equal(resetAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.deepEqual(errors, []);
  await context.close();
}

async function runAdminMobileLayoutSmoke(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_admin_token", token);
  }, ADMIN_TOKEN);
  const page = await context.newPage();
  const errors = [];
  let resultsAuthHeader = "";

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/admin/results", (route) => {
    resultsAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload()),
    });
  });

  await page.goto(`${baseUrl}/admin/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.getElementById("dashboard").classList.contains("hidden"));

  const defaultState = await page.evaluate(() => ({
    activeTab: document.querySelector('[data-admin-tab][aria-selected="true"]')?.getAttribute("data-admin-tab"),
    activePanel: document.querySelector(".admin-tab-panel.is-active")?.getAttribute("data-admin-tab-panel"),
    inputPanelDisplay: getComputedStyle(document.querySelector('[data-admin-tab-panel="input"]')).display,
    overallPanelDisplay: getComputedStyle(document.querySelector('[data-admin-tab-panel="overall"]')).display,
  }));
  assert.equal(defaultState.activeTab, "overall");
  assert.equal(defaultState.activePanel, "overall");
  assert.equal(defaultState.inputPanelDisplay, "none");
  assert.notEqual(defaultState.overallPanelDisplay, "none");

  await page.locator('[data-admin-tab="input"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".live-score-card").length === 3);

  const inputState = await page.evaluate(() => ({
    activeTab: document.querySelector('[data-admin-tab][aria-selected="true"]')?.getAttribute("data-admin-tab"),
    activePanel: document.querySelector(".admin-tab-panel.is-active")?.getAttribute("data-admin-tab-panel"),
    liveScoreDetailsOpen: document.getElementById("liveScoreDetails").open,
    liveScoreCardCount: document.querySelectorAll(".live-score-card").length,
    memberIds: Array.from(document.querySelectorAll(".live-score-card")).map((card) => card.getAttribute("data-member-id")),
    teamTabCount: document.querySelectorAll("#liveScoreTeamTabs button").length,
    liveScoreTabsDisplay: getComputedStyle(document.getElementById("liveScoreTeamTabs")).display,
    pointAtMainVoteStart: calcVotePoint("2026-07-18T22:15:00+09:00"),
    pointDuringMainVote: calcVotePoint("2026-07-18T22:20:00+09:00"),
    maxButtonRadius: Math.max(
      ...Array.from(document.querySelectorAll("button")).map((button) =>
        Number.parseFloat(getComputedStyle(button).borderTopLeftRadius) || 0
      )
    ),
    maxCardRadius: Math.max(
      ...Array.from(document.querySelectorAll(".hero, .panel, .stat-card, .category-block, .table-scroll, .team-group-card, .score-summary-card, .live-score-card")).map((element) =>
        Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0
      )
    ),
  }));
  assert.equal(inputState.activeTab, "input");
  assert.equal(inputState.activePanel, "input");
  assert.equal(inputState.liveScoreDetailsOpen, true);
  assert.equal(inputState.liveScoreCardCount, 3);
  assert.deepEqual(inputState.memberIds, ["1", "2", "3"]);
  assert.equal(inputState.teamTabCount, 3);
  assert.equal(inputState.liveScoreTabsDisplay, "grid");
  assert.equal(inputState.pointAtMainVoteStart, 5000);
  assert.equal(inputState.pointDuringMainVote, 5000);
  assert.ok(inputState.maxButtonRadius <= 8);
  assert.ok(inputState.maxCardRadius <= 8);

  await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusPercent"]').fill("25");
  await page.locator("#liveScoreTeamTabs button").nth(1).click();
  await page.waitForFunction(() => {
    const ids = Array.from(document.querySelectorAll(".live-score-card")).map((card) => card.getAttribute("data-member-id"));
    return ids.join(",") === "4,5,6";
  });
  await page.locator("#liveScoreTeamTabs button").first().click();
  await page.waitForFunction(() => {
    const ids = Array.from(document.querySelectorAll(".live-score-card")).map((card) => card.getAttribute("data-member-id"));
    return ids.join(",") === "1,2,3";
  });
  const preservedDraft = await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusPercent"]').inputValue();
  assert.equal(preservedDraft, "25");

  await page.locator('[data-admin-tab="individual"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#individualAwardTabs button").length === 3);
  const individualState = await page.evaluate(() => ({
    activeTab: document.querySelector('[data-admin-tab][aria-selected="true"]')?.getAttribute("data-admin-tab"),
    awardTabCount: document.querySelectorAll("#individualAwardTabs button").length,
    activeAward: document.querySelector("#individualAwardTabs button[aria-selected='true']")?.textContent.trim(),
    categoryBlocks: document.querySelectorAll("#individualCategoriesWrap .category-block").length,
    leaderLabel: document.querySelector("#individualCategoriesWrap .leader-kicker")?.textContent.trim(),
    leaderName: document.querySelector("#individualCategoriesWrap .leader-name")?.textContent.trim(),
  }));
  assert.equal(individualState.activeTab, "individual");
  assert.equal(individualState.awardTabCount, 3);
  assert.equal(individualState.activeAward, "MVP");
  assert.equal(individualState.categoryBlocks, 1);
  assert.equal(individualState.leaderLabel, "現在トップ");
  assert.ok(individualState.leaderName.includes("Member 4"));

  await page.locator("#individualAwardTabs button").nth(1).click();
  const secondAwardState = await page.evaluate(() => ({
    activeAward: document.querySelector("#individualAwardTabs button[aria-selected='true']")?.textContent.trim(),
    categoryBlocks: document.querySelectorAll("#individualCategoriesWrap .category-block").length,
    leaderName: document.querySelector("#individualCategoriesWrap .leader-name")?.textContent.trim(),
  }));
  assert.equal(secondAwardState.activeAward, "Entertainer");
  assert.equal(secondAwardState.categoryBlocks, 1);
  assert.ok(secondAwardState.leaderName.includes("Member 5"));

  await page.locator('[data-admin-tab="logs"]').click();
  await page.waitForFunction(() =>
    document.querySelectorAll("[data-comment-log-tab]").length === 3 &&
    document.querySelectorAll(".award-comment-section").length === 3
  );
  const defaultLogTabState = await page.evaluate(() => ({
    activeSubTab: document.querySelector('[data-comment-log-tab][aria-selected="true"]')?.getAttribute("data-comment-log-tab"),
    eventPanelDisplay: getComputedStyle(document.querySelector('[data-comment-log-panel="event"]')).display,
    awardsPanelDisplay: getComputedStyle(document.querySelector('[data-comment-log-panel="awards"]')).display,
    auditPanelDisplay: getComputedStyle(document.querySelector('[data-comment-log-panel="audit"]')).display,
    eventImpressionsText: document.getElementById("eventImpressionsBody")?.textContent || "",
  }));
  assert.equal(defaultLogTabState.activeSubTab, "event");
  assert.notEqual(defaultLogTabState.eventPanelDisplay, "none");
  assert.equal(defaultLogTabState.awardsPanelDisplay, "none");
  assert.equal(defaultLogTabState.auditPanelDisplay, "none");
  assert.ok(defaultLogTabState.eventImpressionsText.includes("イベント全体が楽しかった"));

  await page.locator('[data-comment-log-tab="awards"]').click();
  await page.waitForFunction(() => document.querySelector('[data-comment-log-panel="awards"]').classList.contains("is-active"));
  const commentsState = await page.evaluate(() => {
    const mvp = document.querySelector('.award-comment-section[data-award-id="mvp"]');
    const entertainer = document.querySelector('.award-comment-section[data-award-id="entertainer"]');
    const moment = document.querySelector('.award-comment-section[data-award-id="moment"]');
    const member4 = mvp?.querySelector('.recipient-comment-card[data-member-id="4"]');
    const member5 = entertainer?.querySelector('.recipient-comment-card[data-member-id="5"]');
    return {
      activeTabLabel: document.querySelector('[data-admin-tab="logs"]')?.textContent.trim(),
      filterValue: document.getElementById("commentMemberFilter")?.value,
      filterOptionCount: document.querySelectorAll("#commentMemberFilter option").length,
      sectionCount: document.querySelectorAll(".award-comment-section").length,
      cardCount: document.querySelectorAll(".recipient-comment-card").length,
      mvpHeading: mvp?.querySelector("h3")?.textContent.trim(),
      entertainerHeading: entertainer?.querySelector("h3")?.textContent.trim(),
      member4Count: member4?.querySelector(".comment-count")?.textContent.trim(),
      member4Text: member4?.textContent || "",
      member5Text: member5?.textContent || "",
      momentText: moment?.textContent || "",
      activeSubTab: document.querySelector('[data-comment-log-tab][aria-selected="true"]')?.getAttribute("data-comment-log-tab"),
      rawLogHeadingExists: document.getElementById("operationLogWrap").textContent.includes("投票ログ"),
      operationLogRowCount: document.querySelectorAll("#operationVoteLogBody tr").length,
      operationLogText: document.getElementById("operationVoteLogPanel")?.textContent || "",
      eventImpressionsText: document.getElementById("eventImpressionsBody")?.textContent || "",
    };
  });
  assert.equal(commentsState.activeTabLabel, "コメント/ログ");
  assert.equal(commentsState.activeSubTab, "awards");
  assert.equal(commentsState.filterValue, "all");
  assert.equal(commentsState.filterOptionCount, 10);
  assert.equal(commentsState.sectionCount, 3);
  assert.equal(commentsState.cardCount, 2);
  assert.equal(commentsState.mvpHeading, "MVP");
  assert.equal(commentsState.entertainerHeading, "Entertainer");
  assert.equal(commentsState.member4Count, "2件");
  assert.ok(commentsState.member4Text.includes("歌がすごく良かった"));
  assert.ok(commentsState.member4Text.includes("高音が印象的"));
  assert.ok(commentsState.member5Text.includes("盛り上げが最高"));
  assert.ok(commentsState.momentText.includes("コメントはまだありません"));
  assert.equal(commentsState.rawLogHeadingExists, true);
  assert.ok(commentsState.eventImpressionsText.includes("イベント全体が楽しかった"));
  assert.equal(commentsState.operationLogRowCount, 6);
  assert.ok(commentsState.operationLogText.includes("Listener A"));
  assert.equal(commentsState.operationLogText.includes("GLORIA"), false);
  assert.ok(commentsState.operationLogText.includes("GL0RIA"));
  assert.ok(commentsState.operationLogText.includes("一致"));
  assert.ok(commentsState.operationLogText.includes("不一致"));
  assert.ok(commentsState.operationLogText.includes("10,000"));
  assert.ok(commentsState.operationLogText.includes("投票 5,000 / BONUS 5,000"));

  await page.locator("#commentMemberFilter").selectOption("4");
  const filteredCommentsState = await page.evaluate(() => {
    const mvp = document.querySelector('.award-comment-section[data-award-id="mvp"]');
    const entertainer = document.querySelector('.award-comment-section[data-award-id="entertainer"]');
    const moment = document.querySelector('.award-comment-section[data-award-id="moment"]');
    return {
      filterValue: document.getElementById("commentMemberFilter")?.value,
      cardCount: document.querySelectorAll(".recipient-comment-card").length,
      mvpText: mvp?.textContent || "",
      entertainerText: entertainer?.textContent || "",
      momentText: moment?.textContent || "",
    };
  });
  assert.equal(filteredCommentsState.filterValue, "4");
  assert.equal(filteredCommentsState.cardCount, 1);
  assert.ok(filteredCommentsState.mvpText.includes("Member 4"));
  assert.ok(filteredCommentsState.mvpText.includes("歌がすごく良かった"));
  assert.ok(filteredCommentsState.entertainerText.includes("コメントはまだありません"));
  assert.ok(filteredCommentsState.momentText.includes("コメントはまだありません"));

  await page.locator('[data-comment-log-tab="audit"]').click();
  const auditTabState = await page.evaluate(() => ({
    activeSubTab: document.querySelector('[data-comment-log-tab][aria-selected="true"]')?.getAttribute("data-comment-log-tab"),
    auditPanelDisplay: getComputedStyle(document.querySelector('[data-comment-log-panel="audit"]')).display,
    operationLogRowCount: document.querySelectorAll("#operationVoteLogBody tr").length,
    operationLogText: document.getElementById("operationVoteLogPanel")?.textContent || "",
  }));
  assert.equal(auditTabState.activeSubTab, "audit");
  assert.notEqual(auditTabState.auditPanelDisplay, "none");
  assert.equal(auditTabState.operationLogRowCount, 6);
  assert.ok(auditTabState.operationLogText.includes("Listener A"));

  assert.equal(resultsAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.deepEqual(errors, []);
  await context.close();
}

const server = await startStaticServer();
const browser = await chromium.launch();
try {
  await runPublicVoteSmoke(browser, server.baseUrl);
  console.log("OK public vote smoke");
  await runAdminSmoke(browser, server.baseUrl);
  console.log("OK admin smoke");
  await runAdminMobileLayoutSmoke(browser, server.baseUrl);
  console.log("OK admin mobile layout smoke");
  console.log("ALL LOCAL FRONTEND SMOKE TESTS PASSED");
} finally {
  await browser.close();
  await server.close();
}
