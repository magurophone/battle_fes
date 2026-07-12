import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ADMIN_TOKEN = "local-secret";
const EDGE_EXECUTABLE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

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
    result.counts = { ...result.counts, 1: 1, 4: 3, 7: 3 };
    result.totalVotes = 7;
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

function finalResultsPayload() {
  const results = Object.fromEntries(categories.map((category) => [category.id, adminResults(category)]));
  const awards = [
    { categoryId: "mvp", categoryLabel: "MVP", memberId: 4, memberName: "なぽる", teamId: 2, bonusPoint: 30000, votes: 3, tiedWinnerCount: 2 },
    { categoryId: "mvp", categoryLabel: "MVP", memberId: 7, memberName: "🐻‍❄️あわ🥚", teamId: 3, bonusPoint: 30000, votes: 3, tiedWinnerCount: 2 },
    { categoryId: "entertainer", categoryLabel: "Entertainer", memberId: 5, memberName: "犬飼音子(ねこ)", teamId: 2, bonusPoint: 60000, votes: 2, tiedWinnerCount: 1 },
    { categoryId: "moment", categoryLabel: "Moment", memberId: 9, memberName: "iran👳🏾‍♂️痔", teamId: 3, bonusPoint: 60000, votes: 1, tiedWinnerCount: 1 },
  ];
  const standings = [
    { rank: 1, teamId: 2, teamName: "NOVA", votes: 43, voteShare: 33.6, votePoints: 81800, awardPoints: 90000, liveScore: 120000, totalScore: 291800 },
    { rank: 2, teamId: 3, teamName: "GOLDEN", votes: 41, voteShare: 32, votePoints: 71000, awardPoints: 60000, liveScore: 140000, totalScore: 271000 },
    { rank: 3, teamId: 1, teamName: "CRIMSON", votes: 44, voteShare: 34.4, votePoints: 106000, awardPoints: 30000, liveScore: 90000, totalScore: 226000 },
  ];
  return {
    ok: true,
    status: "closed",
    resultsPublishAt: "2026-07-18T23:00:00+09:00",
    config: { categories, teams, members },
    individualAwardBonuses: {
      pointPerAward: 60000,
      teamScores: { 1: 30000, 2: 90000, 3: 60000 },
      totalPoints: 180000,
      awards,
    },
    finalResults: {
      publishedAt: "2026-07-18T23:00:00+09:00",
      winner: standings[0],
      standings,
      awards,
      pointPerAward: 60000,
      totals: { votes: 128, votePoints: 258800, awardPoints: 180000, liveScore: 350000, totalScore: 788800 },
    },
    results,
  };
}

function adminPayload({ status = "waiting", adminVoteStatusOverride = null } = {}) {
  const liveScores = {
    memberScores: Object.fromEntries(
      members.map((member) => [
        member.id,
        {
          memberId: member.id,
          teamId: member.teamId,
          oshiBonusBefore: 0,
          oshiBonusAfter: 0,
          liveScoreBefore: 0,
          liveScoreAfter: 0,
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
    adminVoteStatusOverride,
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
    individualAwardBonuses: {
      pointPerAward: 60000,
      teamScores: { 1: 0, 2: 90000, 3: 90000 },
      totalPoints: 180000,
      awards: [
        { categoryId: "mvp", categoryLabel: "MVP", memberId: 4, memberName: "Member 4", teamId: 2, bonusPoint: 30000, votes: 3, tiedWinnerCount: 2 },
        { categoryId: "mvp", categoryLabel: "MVP", memberId: 7, memberName: "Member 7", teamId: 3, bonusPoint: 30000, votes: 3, tiedWinnerCount: 2 },
        { categoryId: "entertainer", categoryLabel: "Entertainer", memberId: 5, memberName: "Member 5", teamId: 2, bonusPoint: 60000, votes: 2, tiedWinnerCount: 1 },
        { categoryId: "moment", categoryLabel: "Moment", memberId: 9, memberName: "Member 9", teamId: 3, bonusPoint: 60000, votes: 1, tiedWinnerCount: 1 },
      ],
    },
    finalResults: finalResultsPayload().finalResults,
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
    ".svg": "image/svg+xml",
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_test_mode", "1");
    localStorage.setItem("battlefes_admin_token", token);
    localStorage.removeItem("battlefes2026_vote");
  }, ADMIN_TOKEN);
  const page = await context.newPage();
  const errors = [];
  let voteAuthHeader = "";
  let voteClientIdHeader = "";
  let votePayload = null;

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
  await page.route("**/api/admin/results", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload()),
    });
  });

  await page.route("**/api/votes", async (route) => {
    voteAuthHeader = route.request().headers().authorization || "";
    voteClientIdHeader = route.request().headers()["x-battle-fes-client-id"] || "";
    votePayload = JSON.parse(route.request().postData() || "{}");
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
  await page.waitForFunction(() => document.querySelector("#vote .section-title")?.classList.contains("visible"));
  await page.waitForTimeout(1600);

  const titleMotionState = await page.evaluate(() => ({
    titleCount: document.querySelectorAll(".section-title").length,
    charTitleCount: document.querySelectorAll(".section-title.char-reveal").length,
    charCount: document.querySelectorAll(".section-title .char-reveal-char").length,
    labelCount: document.querySelectorAll(".section-label").length,
    lineLabelCount: document.querySelectorAll(".section-label.line-reveal").length,
    labelsWithCharReveal: document.querySelectorAll(".section-label.char-reveal").length,
    voteTitleLabel: document.querySelector("#vote .section-title")?.getAttribute("aria-label"),
    voteTitleChars: Array.from(document.querySelectorAll("#vote .section-title .char-reveal-inner"))
      .map((node) => node.textContent)
      .join(""),
    voteTitlePosition: getComputedStyle(document.querySelector("#vote .section-title")).position,
    voteTitleFilter: getComputedStyle(document.querySelector("#vote .section-title")).filter,
    voteTitleTextShadow: getComputedStyle(document.querySelector("#vote .section-title")).textShadow,
  }));
  assert.equal(titleMotionState.titleCount, 4);
  assert.equal(titleMotionState.charTitleCount, 4);
  assert.ok(titleMotionState.charCount >= 20);
  assert.equal(titleMotionState.labelCount, titleMotionState.lineLabelCount);
  assert.equal(titleMotionState.labelsWithCharReveal, 0);
  assert.equal(titleMotionState.voteTitleLabel, "リスナー投票");
  assert.equal(titleMotionState.voteTitleChars, "リスナー投票");
  assert.equal(titleMotionState.voteTitlePosition, "relative");
  assert.notEqual(titleMotionState.voteTitleFilter, "none");
  assert.equal(titleMotionState.voteTitleTextShadow, "none");

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

  await page.waitForFunction(() =>
    !document.getElementById("voteUI").hidden &&
    document.querySelectorAll("#voteTeams .vote-card").length === 3
  );
  await page.waitForFunction(() =>
    Array.isArray(members) &&
    members.some((member) => member.name === "Member 1")
  );

  await page.locator("#voteTeams .vote-card").first().click();
  await page.locator("#voterName").fill("Smoke User");
  await page.locator("#voteBtn").click();
  await page.waitForFunction(() => document.getElementById("voteModalOverlay").classList.contains("show"));
  await page.locator(".award-section").nth(0).getByRole("button", { name: "Member 1" }).click();
  await page.locator(".award-section").nth(1).getByRole("button", { name: "Member 4" }).click();
  await page.locator(".award-section").nth(2).getByRole("button", { name: "Member 7" }).click();
  await page.locator("#comment-mvp").fill("MVP comment");
  await page.locator("#comment-entertainer").fill("Entertainer comment");
  await page.locator("#comment-moment").fill("Moment comment");
  await page.locator("#eventComment").fill("Smoke comment");
  await page.locator("#bonusKeyword").fill("SMOKE-BONUS");
  await page.locator("#modalSubmitBtn").click();
  await page.waitForFunction(() =>
    voted === true &&
    localStorage.getItem("battlefes2026_vote") === "1" &&
    document.getElementById("thankYouOverlay").classList.contains("show")
  );

  const state = await page.evaluate(() => ({
    token: getAdminTestVoteToken(),
    voted,
    selected,
    voteButtonDisabled: document.getElementById("voteBtn").disabled,
    voteFormDisplay: getComputedStyle(document.getElementById("voteForm")).display,
    modalOpen: document.getElementById("voteModalOverlay").classList.contains("show"),
  }));

  assert.equal(state.token, ADMIN_TOKEN);
  assert.equal(state.voted, true);
  assert.equal(state.selected, 1);
  assert.equal(state.voteButtonDisabled, true);
  assert.equal(state.voteFormDisplay, "none");
  assert.equal(state.modalOpen, false);
  assert.equal(voteAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.ok(voteClientIdHeader.length >= 16);
  assert.equal(votePayload.voterName, "Smoke User");
  assert.equal(votePayload.eventComment, "Smoke comment");
  assert.equal(votePayload.bonusKeyword, "SMOKE-BONUS");
  assert.equal(votePayload.picks.length, 4);
  assert.deepEqual(votePayload.picks, [
    { categoryId: "team", candidateId: 1, comment: "" },
    { categoryId: "mvp", candidateId: 1, comment: "MVP comment" },
    { categoryId: "entertainer", candidateId: 4, comment: "Entertainer comment" },
    { categoryId: "moment", candidateId: 7, comment: "Moment comment" },
  ]);
  assert.deepEqual(errors, []);
  await context.close();
}

async function runPublicFinalResultsSmoke(browser, baseUrl, options = {}) {
  const mobile = options.mobile === true;
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    reducedMotion: options.reducedMotion || "no-preference",
  });
  await context.addInitScript(() => {
    globalThis.__battleFesNow = new Date("2026-07-18T22:59:58+09:00").getTime();
    Date.now = () => globalThis.__battleFesNow;
    localStorage.removeItem("battlefes_test_mode");
    localStorage.removeItem("battlefes2026_vote");
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const errors = [];
  let resultsRequestCount = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/results", (route) => {
    resultsRequestCount += 1;
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(finalResultsPayload()),
    });
  });

  await page.goto(`${baseUrl}/index.html#vote`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    !document.getElementById("resultExperience").hidden &&
    !document.getElementById("resultHolding").hidden &&
    document.getElementById("finalResultStage").hidden
  );
  const holdingState = await page.evaluate(() => ({
    voteHidden: document.getElementById("voteUI").hidden,
    holdingText: document.getElementById("resultHolding").textContent,
    finalHidden: document.getElementById("finalResultStage").hidden,
  }));
  assert.equal(holdingState.voteHidden, true);
  assert.equal(holdingState.finalHidden, true);
  assert.ok(holdingState.holdingText.includes("最終結果を集計中"));

  await page.evaluate(() => {
    globalThis.__battleFesNow = new Date("2026-07-18T23:00:00+09:00").getTime();
  });
  await page.waitForFunction(() =>
    !document.getElementById("finalResultStage").hidden &&
    document.getElementById("finalResultStage").classList.contains("is-visible") &&
    document.querySelectorAll(".result-standing").length === 3 &&
    document.querySelectorAll(".result-award-card").length === 3
  );
  await page.waitForTimeout(options.reducedMotion === "reduce" ? 100 : 1550);

  const state = await page.evaluate(() => {
    const share = document.getElementById("resultShareX");
    const intent = new URL(share.href);
    const stage = document.getElementById("finalResultStage");
    const mvpCard = document.querySelectorAll(".result-award-card")[0];
    return {
      stageText: stage.textContent,
      championAlt: document.querySelector(".result-champion-wordmark")?.getAttribute("alt"),
      championScore: document.querySelector(".result-champion-score")?.textContent.replace(/\s+/g, " ").trim(),
      championTarget: document.querySelector("[data-result-count]")?.getAttribute("data-result-count"),
      standings: document.querySelectorAll(".result-standing").length,
      awards: document.querySelectorAll(".result-award-card").length,
      mvpRecipients: mvpCard?.querySelectorAll(".result-award-recipient").length,
      mvpText: mvpCard?.textContent || "",
      shareHost: intent.host,
      sharePath: intent.pathname,
      shareText: intent.searchParams.get("text"),
      shareTarget: intent.searchParams.get("url"),
      shareHashtags: intent.searchParams.get("hashtags"),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stageOpacity: getComputedStyle(stage).opacity,
    };
  });
  assert.equal(state.championAlt, "NOVA");
  assert.equal(state.championTarget, "291800");
  assert.ok(state.championScore.endsWith("PT"));
  assert.equal(state.standings, 3);
  assert.equal(state.awards, 3);
  assert.equal(state.mvpRecipients, 2);
  assert.ok(state.mvpText.includes("なぽる"));
  assert.ok(state.mvpText.includes("あわ"));
  assert.ok(state.mvpText.includes("同率受賞"));
  assert.ok(state.stageText.includes("ライブスコア"));
  assert.ok(state.stageText.includes("個人賞加点"));
  assert.ok(state.stageText.includes("投票ポイント"));
  assert.equal(state.shareHost, "twitter.com");
  assert.equal(state.sharePath, "/intent/tweet");
  assert.ok(state.shareText.includes("総合優勝：NOVA"));
  assert.ok(state.shareText.includes("MVP：なぽる・🐻‍❄️あわ🥚"));
  assert.ok(state.shareTarget.endsWith("/index.html#vote"));
  assert.equal(state.shareHashtags, "BATTLEFES2026,ColorSing");
  assert.ok(state.horizontalOverflow <= 1);
  assert.equal(state.stageOpacity, "1");
  assert.ok(resultsRequestCount >= 1);
  assert.deepEqual(errors, []);
  if (process.env.CAPTURE_FINAL_RESULTS === "1") {
    await page.evaluate(async () => {
      document.querySelectorAll("nav, #particles").forEach((element) => {
        element.style.display = "none";
      });
      await Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return image.decode().catch(() => {});
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }));
    });
    await page.locator("#resultExperience").screenshot({
      path: mobile
        ? "output/review/final-results-mobile.png"
        : "output/review/final-results-desktop.png",
    });
  }
  await context.close();
}

async function runPublicAdminClosedFinalResultsSmoke(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem("battlefes_test_mode", "1");
    localStorage.setItem("battlefes_admin_token", token);
    localStorage.removeItem("battlefes2026_vote");
  }, ADMIN_TOKEN);
  const page = await context.newPage();
  const errors = [];
  let adminAuthHeader = "";
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
  await page.route("**/api/admin/results", (route) => {
    adminAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: "closed", adminVoteStatusOverride: "closed" })),
    });
  });

  await page.goto(`${baseUrl}/index.html#vote`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    !document.getElementById("finalResultStage").hidden &&
    document.getElementById("finalResultStage").classList.contains("is-visible") &&
    document.getElementById("testModeBadge")?.textContent.includes("RESULT")
  );
  const state = await page.evaluate(() => ({
    voteHidden: document.getElementById("voteUI").hidden,
    resultVisible: !document.getElementById("resultExperience").hidden,
    championAlt: document.querySelector(".result-champion-wordmark")?.getAttribute("alt"),
    badge: document.getElementById("testModeBadge")?.textContent,
  }));
  assert.equal(state.voteHidden, true);
  assert.equal(state.resultVisible, true);
  assert.equal(state.championAlt, "NOVA");
  assert.ok(state.badge.includes("RESULT"));
  assert.equal(adminAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.deepEqual(errors, []);
  await context.close();
}

async function runPublicMobileTeamCardScenario(browser, baseUrl, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  await context.addInitScript(() => {
    localStorage.setItem("battlefes_test_mode", "1");
  });
  const page = await context.newPage();
  await page.route("**/api/results", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(resultsPayload()),
    });
  });
  let teamMediaResponses = 0;
  await page.route("**/assets/site-team-v1/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    await route.continue();
  });
  page.on("response", (response) => {
    if (response.url().includes("/assets/site-team-v1/")) teamMediaResponses += 1;
  });

  await page.goto(`${baseUrl}/index.html#teams`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof isTouchLikeDevice === "function" && document.querySelectorAll(".team-card").length === 3);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  });
  const earlyTeamState = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll(".team-card")).map((card) => ({
      className: card.className,
      opacity: getComputedStyle(card).opacity,
      clipPath: getComputedStyle(card).clipPath,
      backgroundImage: getComputedStyle(card, "::before").backgroundImage,
    })),
  }));
  assert.equal(teamMediaResponses, 0);
  assert.ok(earlyTeamState.cards.every((card) => card.className.includes("visible")));
  assert.ok(earlyTeamState.cards.every((card) => card.opacity === "1"));
  assert.ok(earlyTeamState.cards.every((card) => card.clipPath === "inset(0px)"));
  assert.ok(earlyTeamState.cards.every((card) => card.backgroundImage.includes("/assets/site-team-v1/")));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof isTouchLikeDevice === "function" && document.querySelectorAll(".team-card").length === 3);
  const reloadTeamState = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll(".team-card")).map((card) => ({
      className: card.className,
      opacity: getComputedStyle(card).opacity,
      clipPath: getComputedStyle(card).clipPath,
    })),
  }));
  assert.equal(teamMediaResponses, 0);
  assert.ok(reloadTeamState.cards.every((card) => card.className.includes("visible")));
  assert.ok(reloadTeamState.cards.every((card) => card.opacity === "1"));
  assert.ok(reloadTeamState.cards.every((card) => card.clipPath === "inset(0px)"));
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  });

  await page.evaluate(() => {
    window.__teamCardSmoke = { styleMutations: 0, replayClassMutations: 0 };
    document.querySelectorAll(".team-card").forEach((card) => {
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === "style") {
            window.__teamCardSmoke.styleMutations += 1;
          }
          if (mutation.attributeName === "class" && card.classList.contains("reveal-replayed")) {
            window.__teamCardSmoke.replayClassMutations += 1;
          }
        }
      }).observe(card, { attributes: true, attributeFilter: ["class", "style"] });
    });
  });

  const teamsTop = await page.locator("#teams").evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  const maxScrollY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const scrollPoints = [teamsTop - 40, teamsTop + 260, teamsTop + 680, teamsTop + 1160, teamsTop + 1660, teamsTop + 680]
    .map((y) => Math.max(0, Math.min(maxScrollY, y)));
  const pSamples = [];
  for (const y of scrollPoints) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(180);
    pSamples.push(...await page.evaluate(() =>
      Array.from(document.querySelectorAll(".team-card")).map((card) => Number(card.style.getPropertyValue("--p") || "0.5"))
    ));
  }
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".team-card")).every((card) =>
      card.classList.contains("visible") &&
      getComputedStyle(card).opacity === "1" &&
      getComputedStyle(card).clipPath === "inset(0px)"
    )
  );

  const teamState = await page.evaluate(() => ({
    touchLike: isTouchLikeDevice(),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    cards: Array.from(document.querySelectorAll(".team-card")).map((card) => ({
      className: card.className,
      p: Number(card.style.getPropertyValue("--p") || "0.5"),
      opacity: getComputedStyle(card).opacity,
      clipPath: getComputedStyle(card).clipPath,
      backgroundTransform: getComputedStyle(card, "::before").transform,
    })),
    smoke: window.__teamCardSmoke,
  }));
  const maxPDelta = Math.max(...pSamples.map((p) => Math.abs(p - 0.5)));
  assert.equal(teamState.touchLike, true);
  assert.equal(teamState.reducedMotion, reducedMotion === "reduce");
  assert.equal(teamState.cards.length, 3);
  assert.ok(maxPDelta > 0.05);
  assert.ok(teamState.cards.every((card) => card.className.includes("visible")));
  assert.ok(teamState.cards.every((card) => !card.className.includes("reveal-replayed")));
  assert.ok(teamState.cards.every((card) => card.opacity === "1"));
  assert.ok(teamState.cards.every((card) => card.clipPath === "inset(0px)"));
  assert.ok(teamState.cards.every((card) => card.backgroundTransform !== "none"));
  assert.ok(teamState.smoke.styleMutations > 0);
  assert.equal(teamState.smoke.replayClassMutations, 0);
  await context.close();
}

async function runPublicMobileTeamCardSmoke(browser, baseUrl) {
  await runPublicMobileTeamCardScenario(browser, baseUrl, "no-preference");
  await runPublicMobileTeamCardScenario(browser, baseUrl, "reduce");
}

async function runPublicDesktopTeamStackScenario(browser, baseUrl, width) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem("battlefes_test_mode", "1");
  });
  const page = await context.newPage();
  await page.route("**/api/results", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(resultsPayload()),
    });
  });

  await page.goto(`${baseUrl}/index.html#teams`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".teams-grid > .team-card").length === 3);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  });
  await page.waitForTimeout(300);

  const desktopStyles = await page.evaluate(() => ({
    stackQuery: window.matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)").matches,
    gridColumns: getComputedStyle(document.querySelector(".teams-grid")).gridTemplateColumns,
    cards: Array.from(document.querySelectorAll(".teams-grid > .team-card")).map((card) => ({
      position: getComputedStyle(card).position,
      top: getComputedStyle(card).top,
    })),
  }));
  assert.equal(desktopStyles.stackQuery, true);
  assert.ok(!desktopStyles.gridColumns.includes(" "));
  assert.ok(desktopStyles.cards.every((card) => card.position === "sticky"));
  assert.ok(desktopStyles.cards.every((card) => card.top === "100px"));

  const gridTop = await page.locator(".teams-grid").evaluate((el) =>
    Math.round(el.getBoundingClientRect().top + window.scrollY)
  );
  const samples = [];
  for (let offset = 0; offset <= 1080; offset += 120) {
    await page.evaluate(([top, nextOffset]) => window.scrollTo(0, top + nextOffset), [gridTop, offset]);
    await page.waitForTimeout(100);
    samples.push(await page.evaluate((nextOffset) => {
      const cards = Array.from(document.querySelectorAll(".teams-grid > .team-card"));
      const tops = cards.map((card) => Math.round(card.getBoundingClientRect().top));
      const topCard = document.elementFromPoint(window.innerWidth / 2, 130)?.closest(".team-card");
      return {
        offset: nextOffset,
        tops,
        topCardIndex: cards.indexOf(topCard) + 1,
      };
    }, offset));
  }
  const stacked = samples.find((sample) =>
    Math.abs(sample.tops[0] - 100) <= 2 &&
    Math.abs(sample.tops[1] - 100) <= 2 &&
    sample.tops[2] > 100 &&
    sample.topCardIndex === 2
  );
  assert.ok(stacked, JSON.stringify(samples));
  await context.close();
}

async function runPublicDesktopTeamStackSmoke(browser, baseUrl) {
  await runPublicDesktopTeamStackScenario(browser, baseUrl, 1280);
  await runPublicDesktopTeamStackScenario(browser, baseUrl, 900);
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
  let voteStatusAuthHeader = "";
  const voteStatusPayloads = [];
  let adminStatus = "waiting";
  let adminVoteStatusOverride = null;

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/admin/results", (route) => {
    resultsAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: adminStatus, adminVoteStatusOverride })),
    });
  });

  await page.route("**/api/admin/vote-status", async (route) => {
    voteStatusAuthHeader = route.request().headers().authorization || "";
    const payload = JSON.parse(route.request().postData() || "{}");
    voteStatusPayloads.push(payload);
    adminVoteStatusOverride = payload.status === "closed" ? "closed" : null;
    adminStatus = adminVoteStatusOverride || "waiting";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: adminStatus, adminVoteStatusOverride })),
    });
  });

  await page.route("**/api/admin/reset", (route) => {
    resetAuthHeader = route.request().headers().authorization || "";
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(adminPayload({ status: adminStatus, adminVoteStatusOverride })),
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
    leaderDetail: document.querySelector("#overallCategoryWrap .leader-detail")?.textContent.trim(),
    overallText: document.getElementById("overallCategoryWrap")?.textContent || "",
    aggregateLabels: Array.from(document.querySelectorAll("#overallCategoryWrap .aggregate-section strong"))
      .map((node) => node.textContent.trim().replace(/:$/, "")),
    detailHeaders: Array.from(document.querySelectorAll("#overallCategoryWrap .detail-section thead th"))
      .map((node) => node.textContent.trim()),
  }));
  assert.equal(desktopState.activeTab, "overall");
  assert.equal(desktopState.activePanel, "overall");
  assert.equal(desktopState.liveScoreDetailsOpen, false);
  assert.equal(desktopState.liveScoreCardCount, 9);
  assert.equal(desktopState.liveScoreTabsDisplay, "none");
  assert.ok(desktopState.overallText.includes("全体集計"));
  assert.ok(desktopState.overallText.includes("チーム別内訳"));
  assert.ok(desktopState.overallText.includes("個人賞加点"));
  assert.ok(desktopState.overallText.includes("180,000"));
  assert.deepEqual(desktopState.aggregateLabels.slice(3), [
    "全チームライブスコア",
    "全チーム個人賞加点",
    "全チーム投票ポイント",
    "全チーム総合スコア",
  ]);
  assert.deepEqual(desktopState.detailHeaders, [
    "",
    "ライブスコア",
    "個人賞加点",
    "投票ポイント",
    "総合スコア",
    "投票数",
    "割合",
  ]);

  await page.evaluate(() => activateAdminTab("settings"));
  await page.locator("#testClosedViewToggleBtn").click();
  await page.waitForFunction(() =>
    document.getElementById("testClosedViewToggleBtn")?.textContent.trim().includes("ON")
  );
  const testClosedState = await page.evaluate(() => ({
    buttonText: document.getElementById("testClosedViewToggleBtn")?.textContent.trim(),
    statusText: document.getElementById("testModeStatus")?.textContent.trim(),
    voteStatusText: document.getElementById("voteStatus")?.textContent.trim(),
    leaderLabel: document.querySelector("#overallCategoryWrap .leader-kicker")?.textContent.trim(),
    leaderName: document.querySelector("#overallCategoryWrap .leader-name")?.textContent.trim(),
    leaderDetail: document.querySelector("#overallCategoryWrap .leader-detail")?.textContent.trim(),
  }));
  assert.deepEqual(voteStatusPayloads[0], { status: "closed" });
  assert.equal(testClosedState.buttonText, "締切後表示 ON");
  assert.ok(testClosedState.statusText.includes("締切後表示"));
  assert.equal(testClosedState.voteStatusText, "closed");
  assert.equal(testClosedState.leaderLabel, "WINNER");
  assert.ok(testClosedState.leaderName.includes("NOVA"));
  assert.ok(testClosedState.leaderDetail.includes("91,800"));

  await page.locator("#testClosedViewToggleBtn").click();
  await page.waitForFunction(() =>
    document.getElementById("testClosedViewToggleBtn")?.textContent.trim().includes("OFF")
  );
  const testClosedOffState = await page.evaluate(() => ({
    buttonText: document.getElementById("testClosedViewToggleBtn")?.textContent.trim(),
    voteStatusText: document.getElementById("voteStatus")?.textContent.trim(),
  }));
  assert.deepEqual(voteStatusPayloads[1], { status: null });
  assert.equal(testClosedOffState.buttonText, "締切後表示 OFF");
  assert.equal(testClosedOffState.voteStatusText, "waiting");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("button.danger").click();
  await page.waitForFunction(() => document.getElementById("statusText").textContent.includes("リセット"));

  assert.equal(resultsAuthHeader, `Bearer ${ADMIN_TOKEN}`);
  assert.equal(voteStatusAuthHeader, `Bearer ${ADMIN_TOKEN}`);
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

  await page.route("**/api/admin/live-scores", (route) => {
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

  await page.locator('.live-score-card[data-member-id="1"] [data-score-field="liveScoreBefore"]').fill("0");
  await page.locator('.live-score-card[data-member-id="1"] [data-score-field="liveScoreAfter"]').fill("1");
  await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusBefore"]').fill("10");
  await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusAfter"]').fill("20");
  const increasingBonusScore = await page.locator('.live-score-card[data-member-id="1"] [data-live-score-preview]').textContent();
  assert.equal(increasingBonusScore, "1,000");

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
  const preservedDraft = await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusBefore"]').inputValue();
  const preservedAfterBonus = await page.locator('.live-score-card[data-member-id="1"] [data-score-field="oshiBonusAfter"]').inputValue();
  const preservedScore = await page.locator('.live-score-card[data-member-id="1"] [data-live-score-preview]').textContent();
  assert.equal(preservedDraft, "10");
  assert.equal(preservedAfterBonus, "20");
  assert.equal(preservedScore, "1,000");

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
  assert.equal(individualState.leaderLabel, "同率トップ");
  assert.ok(individualState.leaderName.includes("Member 4"));
  assert.ok(individualState.leaderName.includes("Member 7"));

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

async function launchSmokeBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (existsSync(EDGE_EXECUTABLE)) {
      return await chromium.launch({ executablePath: EDGE_EXECUTABLE });
    }
    throw error;
  }
}

const server = await startStaticServer();
const browser = await launchSmokeBrowser();
try {
  await runPublicVoteSmoke(browser, server.baseUrl);
  console.log("OK public vote smoke");
  await runPublicFinalResultsSmoke(browser, server.baseUrl);
  console.log("OK public final results desktop smoke");
  await runPublicFinalResultsSmoke(browser, server.baseUrl, { mobile: true, reducedMotion: "reduce" });
  console.log("OK public final results mobile/reduced-motion smoke");
  await runPublicAdminClosedFinalResultsSmoke(browser, server.baseUrl);
  console.log("OK public admin closed final-results smoke");
  await runPublicDesktopTeamStackSmoke(browser, server.baseUrl);
  console.log("OK public desktop team stack smoke");
  await runPublicMobileTeamCardSmoke(browser, server.baseUrl);
  console.log("OK public mobile team card smoke");
  await runAdminSmoke(browser, server.baseUrl);
  console.log("OK admin smoke");
  await runAdminMobileLayoutSmoke(browser, server.baseUrl);
  console.log("OK admin mobile layout smoke");
  console.log("ALL LOCAL FRONTEND SMOKE TESTS PASSED");
} finally {
  await browser.close();
  await server.close();
}
