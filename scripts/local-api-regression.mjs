import assert from "node:assert/strict";

import { onRequestPost as postVote } from "../functions/api/votes.js";
import { onRequestGet as getResults } from "../functions/api/results.js";
import { onRequestPost as postBonus } from "../functions/api/check-bonus.js";
import { onRequestGet as getAdminResults } from "../functions/api/admin/results.js";
import { onRequestPost as postAdminReset } from "../functions/api/admin/reset.js";
import { onRequestPost as postAdminLiveScores } from "../functions/api/admin/live-scores.js";
import { onRequestPost as postAdminVoteStatus } from "../functions/api/admin/vote-status.js";
import {
  calcIndividualAwardBonuses,
  calcPublicFinalResults,
  calcLiveScore,
  calcVotePoint,
  isPublicResultsPublished,
  RESULTS_PUBLISH_ISO,
} from "../functions/api/_lib/vote-store.js";

const ADMIN_TOKEN = "local-secret";
const BONUS_KEYWORD = "真夏の夜空に響け！";
const BONUS_KEYWORD_HALFWIDTH = "真夏の夜空に響け!";

class MemoryD1Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    const next = new MemoryD1Statement(this.db, this.sql);
    next.params = params;
    return next;
  }

  async all() {
    return { results: this.db.execute(this.sql, this.params, "all") };
  }

  async first() {
    const rows = this.db.execute(this.sql, this.params, "all");
    return rows[0] || null;
  }

  async run() {
    this.db.execute(this.sql, this.params, "run");
    return { success: true };
  }
}

class MemoryD1 {
  constructor() {
    this.voteSubmissions = [];
    this.votePicks = [];
    this.eventImpressions = [];
    this.liveScores = new Map();
    this.systemState = new Map();
    this.adminAuditLogs = [];
    this.nextSubmissionId = 1;
    this.nextPickId = 1;
    this.nextEventImpressionId = 1;
    this.nextAuditId = 1;
  }

  prepare(sql) {
    return new MemoryD1Statement(this, sql);
  }

  async batch(statements) {
    const backup = this.snapshot();
    try {
      const out = [];
      for (const statement of statements) out.push(await statement.run());
      return out;
    } catch (error) {
      this.restore(backup);
      throw error;
    }
  }

  snapshot() {
    return {
      voteSubmissions: structuredClone(this.voteSubmissions),
      votePicks: structuredClone(this.votePicks),
      eventImpressions: structuredClone(this.eventImpressions),
      liveScores: structuredClone([...this.liveScores.entries()]),
      systemState: structuredClone([...this.systemState.entries()]),
      adminAuditLogs: structuredClone(this.adminAuditLogs),
      nextSubmissionId: this.nextSubmissionId,
      nextPickId: this.nextPickId,
      nextEventImpressionId: this.nextEventImpressionId,
      nextAuditId: this.nextAuditId,
    };
  }

  restore(snapshot) {
    this.voteSubmissions = snapshot.voteSubmissions;
    this.votePicks = snapshot.votePicks;
    this.eventImpressions = snapshot.eventImpressions;
    this.liveScores = new Map(snapshot.liveScores);
    this.systemState = new Map(snapshot.systemState);
    this.adminAuditLogs = snapshot.adminAuditLogs;
    this.nextSubmissionId = snapshot.nextSubmissionId;
    this.nextPickId = snapshot.nextPickId;
    this.nextEventImpressionId = snapshot.nextEventImpressionId;
    this.nextAuditId = snapshot.nextAuditId;
  }

  execute(sql, params) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("insert into vote_submissions")) {
      const [
        fingerprint,
        voterName,
        eventComment,
        votePoint,
        bonusPoint,
        bonusGranted,
        bonusKeywordSubmitted,
        bonusKeywordMatched,
        createdAt,
      ] = params;
      if (this.voteSubmissions.some((entry) => entry.fingerprint === fingerprint)) {
        throw new Error("UNIQUE constraint failed: vote_submissions.fingerprint");
      }
      this.voteSubmissions.push({
        id: this.nextSubmissionId++,
        fingerprint,
        voter_name: voterName,
        event_comment: eventComment,
        vote_point: Number(votePoint),
        bonus_point: Number(bonusPoint),
        bonus_granted: Number(bonusGranted),
        bonus_keyword_submitted: bonusKeywordSubmitted,
        bonus_keyword_matched: Number(bonusKeywordMatched),
        created_at: createdAt,
      });
      return [];
    }

    if (normalized.startsWith("insert into vote_picks")) {
      const [fingerprint, categoryId, candidateId, comment, createdAt] = params;
      const submission = this.voteSubmissions.find((entry) => entry.fingerprint === fingerprint);
      if (!submission) throw new Error("FOREIGN KEY constraint failed");
      if (this.votePicks.some((entry) => entry.submission_id === submission.id && entry.category_id === categoryId)) {
        throw new Error("UNIQUE constraint failed: vote_picks.submission_id, vote_picks.category_id");
      }
      this.votePicks.push({
        id: this.nextPickId++,
        submission_id: submission.id,
        category_id: categoryId,
        candidate_id: Number(candidateId),
        comment,
        created_at: createdAt,
      });
      return [];
    }

    if (normalized.startsWith("insert into event_impressions")) {
      const [fingerprint, voterName, comment, createdAt] = params;
      const submission = this.voteSubmissions.find((entry) => entry.fingerprint === fingerprint);
      if (!submission) throw new Error("FOREIGN KEY constraint failed");
      this.eventImpressions.push({
        id: this.nextEventImpressionId++,
        submission_id: submission.id,
        voter_name: voterName,
        comment,
        created_at: createdAt,
      });
      return [];
    }

    if (normalized.startsWith("insert into live_scores")) {
      const [
        memberId,
        teamId,
        oshiBonusBefore,
        oshiBonusAfter,
        liveScoreBefore,
        liveScoreAfter,
        liveScore,
        updatedAt,
      ] = params;
      this.liveScores.set(Number(memberId), {
        memberId: Number(memberId),
        teamId: Number(teamId),
        oshiBonusBefore: Number(oshiBonusBefore),
        oshiBonusAfter: Number(oshiBonusAfter),
        liveScoreBefore: Number(liveScoreBefore),
        liveScoreAfter: Number(liveScoreAfter),
        liveScore: Number(liveScore),
        updatedAt,
      });
      return [];
    }

    if (normalized.startsWith("insert into admin_audit_logs")) {
      const [action, detailJson, createdAt] = params;
      this.adminAuditLogs.push({
        id: this.nextAuditId++,
        action,
        detail_json: detailJson,
        created_at: createdAt,
      });
      return [];
    }

    if (normalized.startsWith("insert into system_state")) {
      const [key, value, updatedAt] = params;
      this.systemState.set(String(key), {
        key: String(key),
        value: String(value),
        updated_at: updatedAt,
      });
      return [];
    }

    if (normalized.startsWith("delete from system_state")) {
      const [key] = params;
      this.systemState.delete(String(key));
      return [];
    }

    if (normalized.includes("from system_state") && normalized.includes("where key = ?")) {
      const [key] = params;
      const row = this.systemState.get(String(key));
      return row ? [{ value: row.value }] : [];
    }

    if (normalized.startsWith("delete from vote_picks")) {
      this.votePicks = [];
      return [];
    }

    if (normalized.startsWith("delete from event_impressions")) {
      this.eventImpressions = [];
      return [];
    }

    if (normalized.startsWith("delete from vote_submissions")) {
      this.voteSubmissions = [];
      return [];
    }

    if (normalized.includes("from vote_picks p join vote_submissions s") && normalized.includes("group by p.category_id, p.candidate_id")) {
      const grouped = new Map();
      for (const pick of this.votePicks) {
        const submission = this.voteSubmissions.find((entry) => entry.id === pick.submission_id);
        if (!submission) continue;
        const key = `${pick.category_id}:${pick.candidate_id}`;
        const row = grouped.get(key) || {
          categoryId: pick.category_id,
          candidateId: pick.candidate_id,
          votes: 0,
          points: 0,
          bonusCount: 0,
          updatedAt: null,
        };
        row.votes += 1;
        row.points += submission.vote_point + submission.bonus_point;
        if (submission.bonus_point > 0) row.bonusCount += 1;
        row.updatedAt = !row.updatedAt || new Date(submission.created_at) > new Date(row.updatedAt)
          ? submission.created_at
          : row.updatedAt;
        grouped.set(key, row);
      }
      return [...grouped.values()];
    }

    if (normalized.startsWith("select id, fingerprint")) {
      const [fingerprint] = params;
      return this.voteSubmissions
        .filter((entry) => entry.fingerprint === fingerprint)
        .map((entry) => ({
          id: entry.id,
          fingerprint: entry.fingerprint,
          voterName: entry.voter_name,
          eventComment: entry.event_comment,
          votePoint: entry.vote_point,
          bonusPoint: entry.bonus_point,
          bonusGranted: entry.bonus_granted,
          bonusKeywordSubmitted: entry.bonus_keyword_submitted,
          bonusKeywordMatched: entry.bonus_keyword_matched,
          timestamp: entry.created_at,
        }));
    }

    if (normalized.includes("from vote_picks") && normalized.includes("where submission_id = ?")) {
      const [submissionId] = params;
      return this.votePicks
        .filter((entry) => entry.submission_id === submissionId)
        .sort((a, b) => a.id - b.id)
        .map((entry) => ({
          categoryId: entry.category_id,
          candidateId: entry.candidate_id,
          comment: entry.comment,
        }));
    }

    if (normalized.includes("from live_scores")) {
      return [...this.liveScores.values()].sort((a, b) => a.memberId - b.memberId);
    }

    if (normalized.includes("count(*) as totalsubmissions") && normalized.includes("group by p.category_id")) {
      const grouped = new Map();
      for (const pick of this.votePicks) {
        const submission = this.voteSubmissions.find((entry) => entry.id === pick.submission_id);
        if (!submission) continue;
        const row = grouped.get(pick.category_id) || {
          categoryId: pick.category_id,
          totalSubmissions: 0,
          lastVoteAt: null,
          fingerprints: new Set(),
        };
        row.totalSubmissions += 1;
        row.lastVoteAt = !row.lastVoteAt || new Date(submission.created_at) > new Date(row.lastVoteAt)
          ? submission.created_at
          : row.lastVoteAt;
        row.fingerprints.add(submission.fingerprint);
        grouped.set(pick.category_id, row);
      }
      return [...grouped.values()].map((row) => ({
        categoryId: row.categoryId,
        totalSubmissions: row.totalSubmissions,
        lastVoteAt: row.lastVoteAt,
        uniqueFingerprints: row.fingerprints.size,
      }));
    }

    if (normalized.includes("where p.category_id = ?")) {
      const [categoryId, limit] = params;
      return this.votePicks
        .filter((pick) => pick.category_id === categoryId)
        .map((pick) => {
          const submission = this.voteSubmissions.find((entry) => entry.id === pick.submission_id);
          return { pick, submission };
        })
        .filter((entry) => entry.submission)
        .sort((a, b) => new Date(b.submission.created_at) - new Date(a.submission.created_at) || b.pick.id - a.pick.id)
        .slice(0, Number(limit))
        .map(({ pick, submission }) => ({
          categoryId: pick.category_id,
          candidateId: pick.candidate_id,
          voterName: submission.voter_name,
          comment: pick.comment,
          timestamp: submission.created_at,
          votePoint: submission.vote_point,
          bonusPoint: submission.bonus_point,
          bonusGranted: submission.bonus_granted,
          bonusKeywordSubmitted: submission.bonus_keyword_submitted,
          bonusKeywordMatched: submission.bonus_keyword_matched,
        }));
    }

    if (normalized.includes("from event_impressions")) {
      const [limit] = params;
      return this.eventImpressions
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id)
        .slice(0, Number(limit))
        .map((entry) => ({
          voterName: entry.voter_name,
          comment: entry.comment,
          timestamp: entry.created_at,
        }));
    }

    throw new Error(`Unhandled MemoryD1 SQL: ${normalized}`);
  }
}

function createEnv(db = new MemoryD1()) {
  return {
    ADMIN_TOKEN,
    BATTLE_FES_DB: db,
    BONUS_KEYWORD,
  };
}

function createD1Env(db = new MemoryD1()) {
  return createEnv(db);
}

function withNow(iso, fn) {
  const RealDate = globalThis.Date;
  const fixed = new RealDate(iso).getTime();
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(fixed);
      return new RealDate(...args);
    }
    static now() {
      return fixed;
    }
    static parse(value) {
      return RealDate.parse(value);
    }
    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  }

  globalThis.Date = MockDate;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.Date = RealDate;
    });
}

function req(path, { method = "GET", body, auth = false, ip = "203.0.113.10", clientId = "", headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("user-agent")) requestHeaders.set("user-agent", "local-regression");
  if (!requestHeaders.has("accept-language")) requestHeaders.set("accept-language", "ja-JP");
  requestHeaders.set("CF-Connecting-IP", ip);
  if (clientId) requestHeaders.set("x-battle-fes-client-id", clientId);
  if (auth) requestHeaders.set("authorization", `Bearer ${ADMIN_TOKEN}`);
  let payload = body;
  if (body !== undefined && typeof body !== "string") {
    requestHeaders.set("content-type", "application/json");
    payload = JSON.stringify(body);
  }
  return new Request(`https://example.test${path}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function validPicks({ teamId = 1, individualIds = [1, 4, 7] } = {}) {
  return [
    { categoryId: "team", candidateId: teamId, comment: "" },
    { categoryId: "mvp", candidateId: individualIds[0], comment: "mvp" },
    { categoryId: "entertainer", candidateId: individualIds[1], comment: "entertainer" },
    { categoryId: "moment", candidateId: individualIds[2], comment: "moment" },
  ];
}

function voteBody(overrides = {}) {
  return {
    voterName: overrides.voterName || "Local Tester",
    picks: overrides.picks || validPicks(overrides),
    eventComment: overrides.eventComment || "local event comment",
    bonusKeyword: overrides.bonusKeyword || "",
  };
}

async function testCorePointAndLiveScoreMath() {
  assert.equal(calcVotePoint("2026-07-18T20:45:00+09:00"), 100);
  assert.equal(calcVotePoint("2026-07-18T22:15:00+09:00"), 5000);
  assert.equal(calcVotePoint("2026-07-18T22:20:00+09:00"), 5000);
  assert.equal(calcVotePoint("2026-07-18T22:30:00+09:00"), 5000);
  assert.equal(calcLiveScore(25, 25, 0, 2500), 2000);
  assert.equal(calcLiveScore("100%", "100%", 0, "1,000"), 500);
  assert.equal(calcLiveScore(0, 0, 0, 2500), 2500);
  assert.equal(calcLiveScore(10, 20, 0, 1000), 1000);
}

async function testIndividualAwardTieSplit() {
  const twoWay = calcIndividualAwardBonuses({
    mvp: { counts: { 1: 4, 4: 4, 7: 2 } },
  });
  assert.equal(twoWay.pointPerAward, 60000);
  assert.equal(twoWay.totalPoints, 60000);
  assert.equal(twoWay.teamScores[1], 30000);
  assert.equal(twoWay.teamScores[2], 30000);
  assert.equal(twoWay.teamScores[3], 0);
  assert.deepEqual(twoWay.awards.map((award) => award.memberId), [1, 4]);
  assert.deepEqual(twoWay.awards.map((award) => award.bonusPoint), [30000, 30000]);
  assert.ok(twoWay.awards.every((award) => award.tiedWinnerCount === 2));

  const sameTeamTie = calcIndividualAwardBonuses({
    entertainer: { counts: { 1: 5, 2: 5, 4: 5 } },
  });
  assert.equal(sameTeamTie.totalPoints, 60000);
  assert.equal(sameTeamTie.teamScores[1], 40000);
  assert.equal(sameTeamTie.teamScores[2], 20000);
  assert.equal(sameTeamTie.teamScores[3], 0);
  assert.deepEqual(sameTeamTie.awards.map((award) => award.bonusPoint), [20000, 20000, 20000]);

  const nineWay = calcIndividualAwardBonuses({
    moment: { counts: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, 1])) },
  });
  assert.equal(nineWay.totalPoints, 60000);
  assert.equal(nineWay.teamScores[1], 20001);
  assert.equal(nineWay.teamScores[2], 20001);
  assert.equal(nineWay.teamScores[3], 19998);
  assert.deepEqual(nineWay.awards.map((award) => award.bonusPoint), [
    6667, 6667, 6667, 6667, 6667, 6667, 6666, 6666, 6666,
  ]);
  assert.ok(nineWay.awards.every((award) => award.tiedWinnerCount === 9));
}

async function testPublicFinalResultsMathAndGate() {
  assert.equal(RESULTS_PUBLISH_ISO, "2026-07-18T23:00:00+09:00");
  assert.equal(isPublicResultsPublished(new Date("2026-07-18T22:59:59+09:00")), false);
  assert.equal(isPublicResultsPublished(new Date("2026-07-18T23:00:00+09:00")), true);

  const finalResults = calcPublicFinalResults({
    team: {
      counts: { 1: 10, 2: 12, 3: 8 },
      points: { 1: 100000, 2: 120000, 3: 90000 },
      totalVotes: 30,
      totalPoints: 310000,
    },
    mvp: { counts: { 1: 4, 4: 4 } },
    entertainer: { counts: { 5: 3 } },
    moment: { counts: { 9: 2 } },
  }, {
    teamScores: { 1: 50000, 2: 70000, 3: 100000 },
    totalLiveScore: 220000,
  });

  assert.equal(finalResults.winner.teamId, 2);
  assert.equal(finalResults.winner.totalScore, 280000);
  assert.deepEqual(finalResults.standings.map((entry) => entry.teamId), [2, 3, 1]);
  assert.deepEqual(finalResults.standings.map((entry) => entry.totalScore), [280000, 250000, 180000]);
  assert.equal(finalResults.standings.find((entry) => entry.teamId === 1).awardPoints, 30000);
  assert.equal(finalResults.standings.find((entry) => entry.teamId === 2).awardPoints, 90000);
  assert.equal(finalResults.standings.find((entry) => entry.teamId === 3).awardPoints, 60000);
  assert.equal(finalResults.awards.length, 4);
  assert.equal(finalResults.totals.totalScore, 710000);
}

async function testPublicResultsAreSealedUntilPublish() {
  const env = createEnv();
  await withNow("2026-07-18T21:00:00+09:00", async () => {
    const response = await vote(env, { teamId: 2, individualIds: [4, 5, 9] });
    assert.equal(response.status, 200);
    const publicResponse = await getResults({ request: req("/api/results"), env });
    const data = await readJson(publicResponse);
    assert.equal(data.status, "open");
    assert.equal(data.results.team.totalVotes, 1);
    assert.equal(data.results.mvp, undefined);
    assert.equal(data.individualAwardBonuses.totalPoints, 0);
    assert.equal(data.finalResults, null);
  });

  await withNow("2026-07-18T22:45:00+09:00", async () => {
    const response = await getResults({ request: req("/api/results"), env });
    const data = await readJson(response);
    assert.equal(data.status, "closed");
    assert.deepEqual(data.results, {});
    assert.equal(data.individualAwardBonuses.awards.length, 0);
    assert.equal(data.finalResults, null);
  });

  await withNow("2026-07-18T23:00:00+09:00", async () => {
    const response = await getResults({ request: req("/api/results"), env });
    const data = await readJson(response);
    assert.equal(data.status, "closed");
    assert.equal(data.results.mvp.totalVotes, 1);
    assert.equal(data.finalResults.winner.teamId, 2);
    assert.equal(data.finalResults.awards.length, 3);
  });
}

async function vote(env, options = {}) {
  return postVote({
    request: req("/api/votes", {
      method: "POST",
      body: voteBody(options),
      auth: options.auth || false,
      ip: options.ip || "203.0.113.10",
      clientId: options.clientId || "",
      headers: options.headers || {},
    }),
    env,
  });
}

async function testPublicResultsInitial() {
  await withNow("2026-06-02T12:00:00.000Z", async () => {
    const env = createEnv();
    const response = await getResults({ request: req("/api/results"), env });
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.status, "waiting");
    assert.equal(data.config.categories.length, 4);
    assert.equal(data.results.team.totalVotes, 0);
    assert.equal(data.resultsPublishAt, "2026-07-18T23:00:00+09:00");
    assert.equal(data.finalResults, null);
    assert.equal(data.individualAwardBonuses.pointPerAward, 60000);
    assert.equal(data.individualAwardBonuses.totalPoints, 0);
  });
}

async function testAdminAuth() {
  const env = createEnv();
  const noAuth = await getAdminResults({ request: req("/api/admin/results"), env });
  assert.equal(noAuth.status, 401);

  const queryToken = await getAdminResults({
    request: req(`/api/admin/results?token=${ADMIN_TOKEN}`),
    env,
  });
  assert.equal(queryToken.status, 401);

  const bearer = await getAdminResults({
    request: req("/api/admin/results", { auth: true }),
    env,
  });
  assert.equal(bearer.status, 200);
}

async function testAdminVoteStatusOverrideDoesNotAffectPublicVoteGate() {
  await withNow("2026-06-02T12:00:00.000Z", async () => {
    const db = new MemoryD1();
    const env = createEnv(db);

    const noAuth = await postAdminVoteStatus({
      request: req("/api/admin/vote-status", {
        method: "POST",
        body: { status: "closed" },
      }),
      env,
    });
    assert.equal(noAuth.status, 401);

    const enabled = await postAdminVoteStatus({
      request: req("/api/admin/vote-status", {
        method: "POST",
        auth: true,
        body: { status: "closed" },
      }),
      env,
    });
    const enabledData = await readJson(enabled);
    assert.equal(enabled.status, 200);
    assert.equal(enabledData.status, "closed");
    assert.equal(enabledData.adminVoteStatusOverride, "closed");

    const publicResults = await getResults({ request: req("/api/results"), env });
    const publicData = await readJson(publicResults);
    assert.equal(publicResults.status, 200);
    assert.equal(publicData.status, "waiting");
    assert.equal(publicData.adminVoteStatusOverride, undefined);

    const testVote = await vote(env, { auth: true, ip: "203.0.113.90" });
    assert.equal(testVote.status, 200);

    const disabled = await postAdminVoteStatus({
      request: req("/api/admin/vote-status", {
        method: "POST",
        auth: true,
        body: { status: null },
      }),
      env,
    });
    const disabledData = await readJson(disabled);
    assert.equal(disabled.status, 200);
    assert.equal(disabledData.status, "waiting");
    assert.equal(disabledData.adminVoteStatusOverride, null);
    assert.equal(db.adminAuditLogs.some((entry) => entry.action === "admin_vote_status_override.set"), true);
  });
}

async function testWaitingVoteGateAndAdminTestMode() {
  await withNow("2026-06-02T12:00:00.000Z", async () => {
    const env = createEnv();

    const denied = await vote(env, { auth: false });
    assert.equal(denied.status, 403);

    const accepted = await vote(env, { auth: true });
    const acceptedData = await readJson(accepted);
    assert.equal(accepted.status, 200);
    assert.equal(acceptedData.results.team.totalVotes, 1);

    const duplicate = await vote(env, { auth: true });
    assert.equal(duplicate.status, 409);
  });
}

async function testOpenVoteWithoutAdmin() {
  await withNow("2026-07-18T12:00:00.000Z", async () => {
    const env = createEnv();
    const response = await vote(env, { auth: false });
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.results.team.totalVotes, 1);
    assert.ok(data.results.team.totalPoints > 100);
  });
}

async function testConcurrentDifferentFingerprints() {
  await withNow("2026-07-18T12:00:00.000Z", async () => {
    const env = createEnv();
    const [a, b] = await Promise.all([
      vote(env, { ip: "203.0.113.21", teamId: 1 }),
      vote(env, { ip: "203.0.113.22", teamId: 2 }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const results = await getResults({ request: req("/api/results"), env });
    const data = await readJson(results);
    assert.equal(data.results.team.totalVotes, 2);
    assert.equal(data.results.team.counts["1"], 1);
    assert.equal(data.results.team.counts["2"], 1);
  });
}

async function testConcurrentSameFingerprintDoesNotDoubleCount() {
  await withNow("2026-07-18T12:00:00.000Z", async () => {
    const db = new MemoryD1();
    const env = createEnv(db);
    const [a, b] = await Promise.all([
      vote(env, { ip: "203.0.113.30", teamId: 1 }),
      vote(env, { ip: "203.0.113.30", teamId: 1 }),
    ]);
    assert.ok([200, 409].includes(a.status));
    assert.ok([200, 409].includes(b.status));

    const results = await getResults({ request: req("/api/results"), env });
    const data = await readJson(results);
    assert.equal(data.results.team.totalVotes, 1);
    assert.equal(db.voteSubmissions.length, 1);
    assert.equal(db.votePicks.length, 4);
  });
}

async function testIncognitoSameDeviceBlockedButSharedNatAllowed() {
  // 指紋は IP + UserAgent + Accept-Language。clientId は無視する。
  // - 同一端末のシークレットウィンドウ（IP/UA/言語同じ、clientId 違い）は重複ブロック。
  // - 同一 IP でも UA が異なる別端末（モバイル NAT の別の人）は投票可能。
  await withNow("2026-07-18T12:00:00.000Z", async () => {
    const db = new MemoryD1();
    const env = createEnv(db);
    // 1人目: 通常ウィンドウ
    const first = await vote(env, {
      ip: "203.0.113.50",
      clientId: "browser-a",
      teamId: 1,
    });
    // 同一端末のシークレットウィンドウ: clientId は変わるが IP/UA/言語は同じ → ブロック
    const incognito = await vote(env, {
      ip: "203.0.113.50",
      clientId: "browser-b",
      teamId: 2,
    });
    // 同一 IP・別端末（別 UA）: NAT 共有の別の人 → 投票可能
    const otherDevice = await vote(env, {
      ip: "203.0.113.50",
      clientId: "browser-c",
      teamId: 3,
      headers: { "user-agent": "Mozilla/5.0 (other-device)" },
    });

    assert.equal(first.status, 200);
    assert.equal(incognito.status, 409);
    assert.equal(otherDevice.status, 200);

    const results = await getResults({ request: req("/api/results"), env });
    const data = await readJson(results);
    assert.equal(data.results.team.totalVotes, 2);
    assert.equal(data.results.team.counts["1"], 1);
    assert.equal(data.results.team.counts["2"], 0);
    assert.equal(data.results.team.counts["3"], 1);
    assert.equal(db.voteSubmissions.length, 2);
  });
}

async function testBonusFlow() {
  await withNow("2026-07-18T13:20:00.000Z", async () => {
    const env = createEnv();

    const bonusCheck = await postBonus({
      request: req("/api/check-bonus", {
        method: "POST",
        body: { keyword: BONUS_KEYWORD },
      }),
      env,
    });
    const bonusData = await readJson(bonusCheck);
    assert.equal(bonusCheck.status, 200);
    assert.equal(bonusData.valid, true);
    assert.equal(bonusData.inMainPeriod, true);

    const bonusCheckHalfwidth = await postBonus({
      request: req("/api/check-bonus", {
        method: "POST",
        body: { keyword: BONUS_KEYWORD_HALFWIDTH },
      }),
      env,
    });
    const bonusHalfwidthData = await readJson(bonusCheckHalfwidth);
    assert.equal(bonusCheckHalfwidth.status, 200);
    assert.equal(bonusHalfwidthData.valid, true);

    const response = await vote(env, {
      bonusKeyword: BONUS_KEYWORD_HALFWIDTH,
      ip: "203.0.113.40",
    });
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.bonusGranted, true);
    assert.equal(data.results.team.bonusCount, 1);
    assert.ok(data.results.team.totalPoints >= 9000);

    const admin = await getAdminResults({
      request: req("/api/admin/results", { auth: true }),
      env,
    });
    const adminData = await readJson(admin);
    assert.equal(admin.status, 200);
    assert.equal(adminData.categories.team.results.bonusCount, 1);
    assert.equal(adminData.categories.team.voteLog[0].bonusPoint, 5000);
    assert.equal(adminData.categories.team.voteLog[0].bonusKeywordSubmitted, BONUS_KEYWORD_HALFWIDTH);
    assert.equal(adminData.categories.team.voteLog[0].bonusKeywordMatched, true);
  });

  await withNow("2026-07-18T13:20:00.000Z", async () => {
    const env = createEnv();

    const response = await vote(env, {
      bonusKeyword: "真夏の夜空に響け?",
      ip: "203.0.113.41",
    });
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.bonusGranted, false);

    const admin = await getAdminResults({
      request: req("/api/admin/results", { auth: true }),
      env,
    });
    const adminData = await readJson(admin);
    assert.equal(admin.status, 200);
    assert.equal(adminData.categories.team.voteLog[0].bonusPoint, 0);
    assert.equal(adminData.categories.team.voteLog[0].bonusKeywordSubmitted, "真夏の夜空に響け?");
    assert.equal(adminData.categories.team.voteLog[0].bonusKeywordMatched, false);
  });

  await withNow("2026-06-02T12:00:00.000Z", async () => {
    const env = createEnv();
    const outside = await postBonus({
      request: req("/api/check-bonus", {
        method: "POST",
        body: { keyword: BONUS_KEYWORD },
      }),
      env,
    });
    const data = await readJson(outside);
    assert.equal(outside.status, 200);
    assert.equal(data.valid, false);
    assert.equal(data.inMainPeriod, false);
  });
}

async function testPayloadValidation() {
  await withNow("2026-06-02T12:00:00.000Z", async () => {
    const env = createEnv();

    const duplicateIndividuals = await vote(env, {
      auth: true,
      picks: validPicks({ individualIds: [1, 1, 1] }),
    });
    assert.equal(duplicateIndividuals.status, 400);

    const missingCategory = await vote(env, {
      auth: true,
      picks: validPicks().slice(0, 3),
    });
    assert.equal(missingCategory.status, 400);

    const invalidCandidate = await vote(env, {
      auth: true,
      picks: validPicks({ teamId: 99 }),
    });
    assert.equal(invalidCandidate.status, 400);

    const longName = await vote(env, {
      auth: true,
      voterName: "x".repeat(31),
    });
    assert.equal(longName.status, 400);

    const invalidJson = await postVote({
      request: req("/api/votes", {
        method: "POST",
        auth: true,
        body: "{invalid",
        headers: { "content-type": "application/json" },
      }),
      env,
    });
    assert.equal(invalidJson.status, 400);
  });
}

async function testAdminLiveScores() {
  const env = createEnv();

  const noAuth = await postAdminLiveScores({
    request: req("/api/admin/live-scores", {
      method: "POST",
      body: { memberScores: [] },
    }),
    env,
  });
  assert.equal(noAuth.status, 401);

  const invalidJson = await postAdminLiveScores({
    request: req("/api/admin/live-scores", {
      method: "POST",
      auth: true,
      body: "{invalid",
      headers: { "content-type": "application/json" },
    }),
    env,
  });
  assert.equal(invalidJson.status, 400);

  const saved = await postAdminLiveScores({
    request: req("/api/admin/live-scores", {
      method: "POST",
      auth: true,
      body: {
        memberScores: [
          { memberId: 1, oshiBonusBefore: 25, oshiBonusAfter: 25, liveScoreBefore: 0, liveScoreAfter: 2500 },
          { memberId: 4, oshiBonusBefore: "100%", oshiBonusAfter: "100%", liveScoreBefore: 0, liveScoreAfter: "1,000" },
          { memberId: 7, oshiBonusBefore: 10, oshiBonusAfter: 20, liveScoreBefore: 0, liveScoreAfter: 1000 },
        ],
      },
    }),
    env,
  });
  const savedData = await readJson(saved);
  assert.equal(saved.status, 200);
  assert.equal(savedData.liveScores.memberScores["1"].liveScore, 2000);
  assert.equal(savedData.liveScores.memberScores["4"].liveScore, 500);
  assert.equal(savedData.liveScores.memberScores["7"].oshiBonusAfter, 20);
  assert.equal(savedData.liveScores.memberScores["7"].liveScore, 1000);
  assert.equal(savedData.liveScores.teamScores["1"], 2000);
  assert.equal(savedData.liveScores.teamScores["2"], 500);
  assert.equal(savedData.liveScores.teamScores["3"], 1000);
  assert.equal(savedData.liveScores.totalLiveScore, 3500);

  const admin = await getAdminResults({
    request: req("/api/admin/results", { auth: true }),
    env,
  });
  const adminData = await readJson(admin);
  assert.equal(admin.status, 200);
  assert.equal(adminData.liveScores.memberScores["1"].liveScoreAfter, 2500);
  assert.equal(adminData.liveScores.teamScores["1"], 2000);
  assert.equal(adminData.liveScores.teamScores["3"], 1000);
}

async function testD1VoteAdminAndDuplicate() {
  await withNow("2026-07-18T12:00:00.000Z", async () => {
    const db = new MemoryD1();
    const env = createD1Env(db);

    const first = await vote(env, { ip: "203.0.113.60", teamId: 2 });
    const firstData = await readJson(first);
    assert.equal(first.status, 200);
    assert.equal(firstData.results.team.totalVotes, 1);
    assert.equal(firstData.results.team.counts["2"], 1);
    assert.equal(db.voteSubmissions.length, 1);
    assert.equal(db.votePicks.length, 4);

    const duplicate = await vote(env, { ip: "203.0.113.60", teamId: 2 });
    const duplicateData = await readJson(duplicate);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicateData.duplicate, true);
    assert.equal(db.voteSubmissions.length, 1);
    assert.equal(db.votePicks.length, 4);

    const second = await vote(env, {
      ip: "203.0.113.61",
      teamId: 3,
      individualIds: [4, 5, 8],
    });
    assert.equal(second.status, 200);

    const admin = await getAdminResults({
      request: req("/api/admin/results", { auth: true }),
      env,
    });
  const adminData = await readJson(admin);
  assert.equal(admin.status, 200);
  assert.equal(adminData.categories.team.results.totalVotes, 2);
  assert.equal(adminData.categories.team.results.counts["2"], 1);
  assert.equal(adminData.categories.team.results.counts["3"], 1);
  assert.equal(adminData.individualAwardBonuses.pointPerAward, 60000);
  assert.equal(adminData.individualAwardBonuses.teamScores["1"], 30000);
  assert.equal(adminData.individualAwardBonuses.teamScores["2"], 90000);
  assert.equal(adminData.individualAwardBonuses.teamScores["3"], 60000);
  assert.equal(adminData.individualAwardBonuses.totalPoints, 180000);
  assert.equal(adminData.individualAwardBonuses.awards.length, 6);
  assert.ok(adminData.individualAwardBonuses.awards.every((award) => award.tiedWinnerCount === 2));
  assert.equal(adminData.finalResults.standings.length, 3);
  assert.equal(adminData.finalResults.winner.teamId, 2);
  assert.equal(adminData.categories.team.meta.totalSubmissions, 2);
  assert.equal(adminData.categories.team.uniqueFingerprints, 2);
  assert.equal(adminData.categories.team.voteLog.length, 2);
    assert.equal(adminData.eventImpressions.length, 2);
  });
}

async function testD1BonusLiveScoresAndReset() {
  await withNow("2026-07-18T13:20:00.000Z", async () => {
    const db = new MemoryD1();
    const env = createD1Env(db);

    const response = await vote(env, {
      bonusKeyword: BONUS_KEYWORD,
      ip: "203.0.113.70",
    });
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.bonusGranted, true);
    assert.equal(data.results.team.bonusCount, 1);

    const saved = await postAdminLiveScores({
      request: req("/api/admin/live-scores", {
        method: "POST",
        auth: true,
        body: {
          memberScores: [
            { memberId: 1, oshiBonusBefore: 25, oshiBonusAfter: 25, liveScoreBefore: 0, liveScoreAfter: 2500 },
            { memberId: 4, oshiBonusBefore: "100%", oshiBonusAfter: "100%", liveScoreBefore: 0, liveScoreAfter: "1,000" },
            { memberId: 7, oshiBonusBefore: 10, oshiBonusAfter: 20, liveScoreBefore: 0, liveScoreAfter: 1000 },
          ],
        },
      }),
      env,
    });
    const savedData = await readJson(saved);
    assert.equal(saved.status, 200);
    assert.equal(savedData.liveScores.memberScores["1"].liveScore, 2000);
    assert.equal(savedData.liveScores.memberScores["4"].liveScore, 500);
    assert.equal(savedData.liveScores.memberScores["7"].oshiBonusAfter, 20);
    assert.equal(savedData.liveScores.memberScores["7"].liveScore, 1000);
    assert.equal(savedData.liveScores.totalLiveScore, 3500);
    assert.equal(db.liveScores.size, 9);
    assert.equal(db.adminAuditLogs.some((entry) => entry.action === "live_scores.save"), true);

    const resetNoAuth = await postAdminReset({
      request: req("/api/admin/reset", { method: "POST" }),
      env,
    });
    assert.equal(resetNoAuth.status, 401);

    const reset = await postAdminReset({
      request: req("/api/admin/reset", { method: "POST", auth: true }),
      env,
    });
    const resetData = await readJson(reset);
    assert.equal(reset.status, 200);
    assert.equal(resetData.categories.team.results.totalVotes, 0);
    assert.equal(db.voteSubmissions.length, 0);
    assert.equal(db.votePicks.length, 0);
    assert.equal(db.eventImpressions.length, 0);
    assert.equal(db.liveScores.size, 9);
    assert.equal(db.adminAuditLogs.some((entry) => entry.action === "votes.reset"), true);
  });
}

const tests = [
  testCorePointAndLiveScoreMath,
  testIndividualAwardTieSplit,
  testPublicFinalResultsMathAndGate,
  testPublicResultsAreSealedUntilPublish,
  testPublicResultsInitial,
  testAdminAuth,
  testAdminVoteStatusOverrideDoesNotAffectPublicVoteGate,
  testWaitingVoteGateAndAdminTestMode,
  testOpenVoteWithoutAdmin,
  testConcurrentDifferentFingerprints,
  testConcurrentSameFingerprintDoesNotDoubleCount,
  testIncognitoSameDeviceBlockedButSharedNatAllowed,
  testBonusFlow,
  testPayloadValidation,
  testAdminLiveScores,
  testD1VoteAdminAndDuplicate,
  testD1BonusLiveScoresAndReset,
];

for (const test of tests) {
  await test();
  console.log(`OK ${test.name}`);
}

console.log(`ALL ${tests.length} LOCAL API REGRESSION TESTS PASSED`);
