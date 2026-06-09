import {
  CATEGORIES,
  CATEGORY_IDS,
  MEMBERS,
  TEAMS,
  getCategory,
  isValidCandidateForCategory,
} from "./vote-categories.js";

const MAX_LOG_ENTRIES = 500;
const MAX_EVENT_IMPRESSIONS = 1000;
const D1_BINDING_NAMES = ["BATTLE_FES_DB", "BATTLE_FES_VOTE_DB", "DB"];

// 投票時間ウィンドウとポイント計算 (public 側 VOTE POWER と同一仕様)
// 受付開始 100PT → 本投票開始 5000PT、以後は終了まで 5000PT 固定
const VOTE_OPEN_ISO = "2026-07-18T20:45:00+09:00";
const VOTE_CLOSE_ISO = "2026-07-18T22:30:00+09:00";
// 本投票時間: 22:15-22:30 の 15 分間 (この時間のみ貫通 BONUS のキーワード入力可能)
const MAIN_VOTE_OPEN_ISO = "2026-07-18T22:15:00+09:00";
const VOTE_POINT_MAX_ISO = MAIN_VOTE_OPEN_ISO;
const VP_MIN = 100;
const VP_MAX = 5000;
// 貫通 BONUS: 本投票時間中に正解キーワードを入力した投票に付与される追加ポイント
const BONUS_POINT = 5000;

function getDb(source) {
  if (!source || typeof source !== "object") {
    throw new Error("D1 database binding is not configured.");
  }
  for (const name of D1_BINDING_NAMES) {
    const db = source[name];
    if (db && typeof db.prepare === "function") return db;
  }
  throw new Error("D1 database binding is not configured.");
}

function rows(result) {
  return result && Array.isArray(result.results) ? result.results : [];
}

function isUniqueConstraintError(error) {
  const message = String((error && error.message) || error || "");
  return message.includes("UNIQUE constraint failed") || message.includes("SQLITE_CONSTRAINT");
}

function calcVotePoint(iso) {
  if (!iso) return VP_MIN;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return VP_MIN;
  const open = new Date(VOTE_OPEN_ISO).getTime();
  const close = new Date(VOTE_POINT_MAX_ISO).getTime();
  if (t <= open) return VP_MIN;
  if (t >= close) return VP_MAX;
  const progress = (t - open) / (close - open);
  return Math.round(VP_MIN + (VP_MAX - VP_MIN) * progress);
}

function isMainVotingPeriod(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const open = new Date(MAIN_VOTE_OPEN_ISO).getTime();
  const close = new Date(VOTE_CLOSE_ISO).getTime();
  return t >= open && t <= close;
}

function normalizeStoredPoint(value, fallback = 0) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return fallback;
}

function normalizeStoredBoolean(value) {
  if (typeof value === "boolean") return value;
  if (String(value).toLowerCase() === "true") return true;
  return Number(value) === 1;
}

function normalizeBonusKeywordAudit(submitted, matched) {
  return {
    bonusKeywordSubmitted: String(submitted || "").trim(),
    bonusKeywordMatched: normalizeStoredBoolean(matched),
  };
}

function roundToHundred(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / 100) * 100;
}

function normalizeScoreInput(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const normalized = String(value)
    .trim()
    .replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10))
    .replace(/[．]/g, ".")
    .replace(/[，、]/g, ",")
    .replace(/[,%％\s]/g, "");
  const n = Number(normalized);
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

function calcLiveScore(oshiBonusPercent, monthlyOshiPointInFrame) {
  const addPercent = normalizeScoreInput(oshiBonusPercent, 0);
  const monthlyPoint = roundToHundred(normalizeScoreInput(monthlyOshiPointInFrame, 0));
  if (monthlyPoint <= 0) return 0;
  return roundToHundred(monthlyPoint / (1 + addPercent / 100));
}

function createLiveScoreSourceMap(raw) {
  const source =
    raw && raw.memberScores !== undefined
      ? raw.memberScores
      : raw && raw.scores !== undefined
        ? raw.scores
        : raw;
  const map = new Map();

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!entry || typeof entry !== "object") continue;
      const id = Number(entry.memberId ?? entry.id);
      if (Number.isFinite(id)) map.set(id, entry);
    }
    return map;
  }

  if (source && typeof source === "object") {
    for (const [key, entry] of Object.entries(source)) {
      const id = Number((entry && (entry.memberId ?? entry.id)) ?? key);
      if (Number.isFinite(id)) map.set(id, entry || {});
    }
  }

  return map;
}

function normalizeLiveScores(raw = {}) {
  const sourceMap = createLiveScoreSourceMap(raw);
  const memberScores = {};
  const teamScores = Object.fromEntries(TEAMS.map((team) => [team.id, 0]));
  let totalLiveScore = 0;

  for (const member of MEMBERS) {
    const source = sourceMap.get(Number(member.id)) || {};
    const oshiBonusPercent = normalizeScoreInput(
      source.oshiBonusPercent ??
        source.bonusPercent ??
        source.oshiBonusRatePercent,
      0
    );
    const monthlyOshiPointInFrame = roundToHundred(normalizeScoreInput(
      source.monthlyOshiPointInFrame ??
        source.monthlyOshiPoint ??
        source.monthlyPoint,
      0
    ));
    const liveScore = calcLiveScore(oshiBonusPercent, monthlyOshiPointInFrame);

    memberScores[member.id] = {
      memberId: member.id,
      teamId: member.teamId,
      oshiBonusPercent,
      monthlyOshiPointInFrame,
      liveScore,
    };
    teamScores[member.teamId] = (teamScores[member.teamId] || 0) + liveScore;
    totalLiveScore += liveScore;
  }

  return {
    schemaVersion: 1,
    memberScores,
    teamScores,
    totalLiveScore,
    updatedAt: raw && raw.updatedAt ? raw.updatedAt : null,
  };
}

function createEmptyResultsForCategory(category) {
  const counts = {};
  const points = {};
  for (const id of category.candidateIds) {
    counts[id] = 0;
    points[id] = 0;
  }
  return {
    counts,
    points,
    totalVotes: 0,
    totalPoints: 0,
    bonusCount: 0,
    updatedAt: null,
  };
}

function latestTimestamp(left, right) {
  const lt = new Date(left || 0).getTime();
  const rt = new Date(right || 0).getTime();
  if (!Number.isFinite(lt)) return right || null;
  if (!Number.isFinite(rt)) return left || null;
  return rt >= lt ? right : left;
}

function createEmptySnapshot() {
  const categories = {};
  for (const c of CATEGORIES) {
    categories[c.id] = {
      results: createEmptyResultsForCategory(c),
      meta: { totalSubmissions: 0, lastVoteAt: null },
      voteLog: [],
      uniqueFingerprints: 0,
    };
  }
  return {
    categories,
    eventImpressions: [],
    results: Object.fromEntries(
      CATEGORIES.map((c) => [c.id, categories[c.id].results])
    ),
  };
}

function applyResultRow(snapshot, row) {
  const categoryId = String(row.categoryId || row.category_id || "");
  const category = getCategory(categoryId);
  if (!category) return;
  const candidateId = Number(row.candidateId ?? row.candidate_id);
  if (!isValidCandidateForCategory(categoryId, candidateId)) return;

  const result = snapshot.results[categoryId] || createEmptyResultsForCategory(category);
  result.counts[candidateId] = normalizeStoredPoint(row.votes, 0);
  result.points[candidateId] = normalizeStoredPoint(row.points, 0);
  result.bonusCount += normalizeStoredPoint(row.bonusCount ?? row.bonus_count, 0);
  result.updatedAt = latestTimestamp(result.updatedAt, row.updatedAt ?? row.updated_at);
  snapshot.results[categoryId] = result;
  snapshot.categories[categoryId].results = result;
}

function finalizeResults(snapshot) {
  for (const category of CATEGORIES) {
    const result = snapshot.results[category.id];
    result.totalVotes = Object.values(result.counts).reduce((sum, value) => sum + value, 0);
    result.totalPoints = Object.values(result.points).reduce((sum, value) => sum + value, 0);
  }
  return snapshot.results;
}

async function readAllResults(store) {
  const db = getDb(store);
  const snapshot = createEmptySnapshot();
  const resultRows = rows(await db.prepare(`
    SELECT
      p.category_id AS categoryId,
      p.candidate_id AS candidateId,
      COUNT(*) AS votes,
      COALESCE(SUM(s.vote_point + s.bonus_point), 0) AS points,
      COALESCE(SUM(CASE WHEN s.bonus_point > 0 THEN 1 ELSE 0 END), 0) AS bonusCount,
      MAX(s.created_at) AS updatedAt
    FROM vote_picks p
    JOIN vote_submissions s ON s.id = p.submission_id
    GROUP BY p.category_id, p.candidate_id
  `).all());

  for (const row of resultRows) applyResultRow(snapshot, row);
  return finalizeResults(snapshot);
}

async function readResults(store, categoryId) {
  const category = getCategory(categoryId);
  if (!category) return null;
  const results = await readAllResults(store);
  return results[categoryId] || createEmptyResultsForCategory(category);
}

async function readExistingSubmission(db, fingerprint) {
  const row = await db.prepare(`
    SELECT
      id,
      fingerprint,
      voter_name AS voterName,
      event_comment AS eventComment,
      vote_point AS votePoint,
      bonus_point AS bonusPoint,
      bonus_granted AS bonusGranted,
      bonus_keyword_submitted AS bonusKeywordSubmitted,
      bonus_keyword_matched AS bonusKeywordMatched,
      created_at AS timestamp
    FROM vote_submissions
    WHERE fingerprint = ?
  `).bind(fingerprint).first();
  if (!row) return null;

  const picks = rows(await db.prepare(`
    SELECT
      category_id AS categoryId,
      candidate_id AS candidateId,
      comment
    FROM vote_picks
    WHERE submission_id = ?
    ORDER BY id ASC
  `).bind(row.id).all());

  return {
    fingerprint: String(row.fingerprint || fingerprint),
    voterName: String(row.voterName || ""),
    picks: picks.map((pick) => ({
      categoryId: String(pick.categoryId || ""),
      candidateId: Number(pick.candidateId),
      comment: String(pick.comment || ""),
    })),
    eventComment: String(row.eventComment || ""),
    timestamp: row.timestamp || null,
    votePoint: normalizeStoredPoint(row.votePoint, 0),
    bonusPoint: normalizeStoredPoint(row.bonusPoint, 0),
    bonusGranted: Boolean(Number(row.bonusGranted)),
    ...normalizeBonusKeywordAudit(row.bonusKeywordSubmitted, row.bonusKeywordMatched),
  };
}

async function recordBulkVotes(store, fingerprint, payload, opts = {}) {
  const db = getDb(store);
  const picks = payload.picks;
  const now =
    typeof payload.timestamp === "string" && payload.timestamp.trim()
      ? payload.timestamp.trim()
      : new Date().toISOString();
  const votePoint = calcVotePoint(now);
  const submittedBonusKeyword = String(payload.bonusKeyword || "").trim();
  const bonusKeywordMatched = Boolean(opts.bonusKeywordMatched ?? opts.bonusGranted);
  const bonusPoint = bonusKeywordMatched && isMainVotingPeriod(now) ? BONUS_POINT : 0;
  const eventComment = String(payload.eventComment || "").trim();

  const statements = [
    db.prepare(`
      INSERT INTO vote_submissions (
        fingerprint,
        voter_name,
        event_comment,
        vote_point,
        bonus_point,
        bonus_granted,
        bonus_keyword_submitted,
        bonus_keyword_matched,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fingerprint,
      payload.voterName,
      eventComment,
      votePoint,
      bonusPoint,
      bonusPoint > 0 ? 1 : 0,
      submittedBonusKeyword,
      bonusKeywordMatched ? 1 : 0,
      now
    ),
  ];

  for (const pick of picks) {
    statements.push(
      db.prepare(`
        INSERT INTO vote_picks (
          submission_id,
          category_id,
          candidate_id,
          comment,
          created_at
        ) VALUES (
          (SELECT id FROM vote_submissions WHERE fingerprint = ?),
          ?,
          ?,
          ?,
          ?
        )
      `).bind(
        fingerprint,
        pick.categoryId,
        Number(pick.candidateId),
        String(pick.comment || ""),
        now
      )
    );
  }

  if (eventComment) {
    statements.push(
      db.prepare(`
        INSERT INTO event_impressions (
          submission_id,
          voter_name,
          comment,
          created_at
        ) VALUES (
          (SELECT id FROM vote_submissions WHERE fingerprint = ?),
          ?,
          ?,
          ?
        )
      `).bind(fingerprint, payload.voterName, eventComment, now)
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        duplicate: true,
        conflicts: picks.map((pick) => pick.categoryId),
        existing: await readExistingSubmission(db, fingerprint),
      };
    }
    throw error;
  }

  return {
    ok: true,
    duplicate: false,
    votePoint,
    bonusPoint,
    bonusGranted: bonusPoint > 0,
    results: await readAllResults(store),
  };
}

async function readLiveScores(store) {
  const db = getDb(store);
  const scoreRows = rows(await db.prepare(`
    SELECT
      member_id AS memberId,
      team_id AS teamId,
      oshi_bonus_percent AS oshiBonusPercent,
      monthly_oshi_point_in_frame AS monthlyOshiPointInFrame,
      live_score AS liveScore,
      updated_at AS updatedAt
    FROM live_scores
    ORDER BY member_id ASC
  `).all());
  const updatedAt = scoreRows.reduce((latest, row) => latestTimestamp(latest, row.updatedAt), null);
  return normalizeLiveScores({ memberScores: scoreRows, updatedAt });
}

async function saveLiveScores(store, payload) {
  const db = getDb(store);
  const now = new Date().toISOString();
  const liveScores = normalizeLiveScores({
    memberScores: payload && payload.memberScores,
    updatedAt: now,
  });
  const statements = Object.values(liveScores.memberScores).map((entry) =>
    db.prepare(`
      INSERT INTO live_scores (
        member_id,
        team_id,
        oshi_bonus_percent,
        monthly_oshi_point_in_frame,
        live_score,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET
        team_id = excluded.team_id,
        oshi_bonus_percent = excluded.oshi_bonus_percent,
        monthly_oshi_point_in_frame = excluded.monthly_oshi_point_in_frame,
        live_score = excluded.live_score,
        updated_at = excluded.updated_at
    `).bind(
      Number(entry.memberId),
      Number(entry.teamId),
      Number(entry.oshiBonusPercent),
      Number(entry.monthlyOshiPointInFrame),
      Number(entry.liveScore),
      now
    )
  );

  statements.push(
    db.prepare(`
      INSERT INTO admin_audit_logs (action, detail_json, created_at)
      VALUES (?, ?, ?)
    `).bind(
      "live_scores.save",
      JSON.stringify({ totalLiveScore: liveScores.totalLiveScore }),
      now
    )
  );

  await db.batch(statements);
  return liveScores;
}

async function buildAdminSnapshot(store) {
  const db = getDb(store);
  const snapshot = createEmptySnapshot();
  snapshot.results = await readAllResults(store);
  for (const category of CATEGORIES) {
    snapshot.categories[category.id].results = snapshot.results[category.id];
  }

  const metaRows = rows(await db.prepare(`
    SELECT
      p.category_id AS categoryId,
      COUNT(*) AS totalSubmissions,
      MAX(s.created_at) AS lastVoteAt,
      COUNT(DISTINCT s.fingerprint) AS uniqueFingerprints
    FROM vote_picks p
    JOIN vote_submissions s ON s.id = p.submission_id
    GROUP BY p.category_id
  `).all());

  for (const row of metaRows) {
    const categoryId = String(row.categoryId || "");
    if (!snapshot.categories[categoryId]) continue;
    snapshot.categories[categoryId].meta = {
      totalSubmissions: normalizeStoredPoint(row.totalSubmissions, 0),
      lastVoteAt: row.lastVoteAt || null,
    };
    snapshot.categories[categoryId].uniqueFingerprints = normalizeStoredPoint(row.uniqueFingerprints, 0);
  }

  await Promise.all(
    CATEGORIES.map(async (category) => {
      const logRows = rows(await db.prepare(`
        SELECT
          p.category_id AS categoryId,
          p.candidate_id AS candidateId,
          s.voter_name AS voterName,
          p.comment AS comment,
          s.created_at AS timestamp,
          s.vote_point AS votePoint,
          s.bonus_point AS bonusPoint,
          s.bonus_granted AS bonusGranted,
          s.bonus_keyword_submitted AS bonusKeywordSubmitted,
          s.bonus_keyword_matched AS bonusKeywordMatched
        FROM vote_picks p
        JOIN vote_submissions s ON s.id = p.submission_id
        WHERE p.category_id = ?
        ORDER BY s.created_at DESC, p.id DESC
        LIMIT ?
      `).bind(category.id, MAX_LOG_ENTRIES).all());
      snapshot.categories[category.id].voteLog = logRows.map((row) => ({
        categoryId: String(row.categoryId || category.id),
        candidateId: Number(row.candidateId),
        voterName: String(row.voterName || ""),
        comment: String(row.comment || ""),
        timestamp: row.timestamp || null,
        votePoint: normalizeStoredPoint(row.votePoint, 0),
        bonusPoint: normalizeStoredPoint(row.bonusPoint, 0),
        bonusGranted: Boolean(Number(row.bonusGranted)),
        ...normalizeBonusKeywordAudit(row.bonusKeywordSubmitted, row.bonusKeywordMatched),
      }));
    })
  );

  snapshot.eventImpressions = rows(await db.prepare(`
    SELECT
      voter_name AS voterName,
      comment,
      created_at AS timestamp
    FROM event_impressions
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).bind(MAX_EVENT_IMPRESSIONS).all()).map((row) => ({
    voterName: String(row.voterName || ""),
    comment: String(row.comment || ""),
    timestamp: row.timestamp || null,
  }));

  return {
    categories: snapshot.categories,
    eventImpressions: snapshot.eventImpressions,
    liveScores: await readLiveScores(store),
  };
}

async function readVoteLog(store, categoryId) {
  const snapshot = await buildAdminSnapshot(store);
  return (snapshot.categories[categoryId] && snapshot.categories[categoryId].voteLog) || [];
}

async function readEventImpressions(store) {
  const snapshot = await buildAdminSnapshot(store);
  return snapshot.eventImpressions;
}

async function resetAllVotes(store) {
  const db = getDb(store);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM vote_picks"),
    db.prepare("DELETE FROM event_impressions"),
    db.prepare("DELETE FROM vote_submissions"),
    db.prepare(`
      INSERT INTO admin_audit_logs (action, detail_json, created_at)
      VALUES (?, ?, ?)
    `).bind("votes.reset", JSON.stringify({ source: "admin" }), now),
  ]);
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.id, createEmptyResultsForCategory(c)])
  );
}

function getVoteWindowStatus() {
  if (!VOTE_OPEN_ISO || !VOTE_CLOSE_ISO) return "waiting";
  const now = Date.now();
  const openAt = new Date(VOTE_OPEN_ISO).getTime();
  const closeAt = new Date(VOTE_CLOSE_ISO).getTime();
  if (now < openAt) return "waiting";
  if (now > closeAt) return "closed";
  return "open";
}

function isVoteSubmissionAllowed() {
  return getVoteWindowStatus() === "open";
}

export {
  CATEGORIES,
  CATEGORY_IDS,
  VOTE_OPEN_ISO,
  VOTE_CLOSE_ISO,
  MAIN_VOTE_OPEN_ISO,
  VOTE_POINT_MAX_ISO,
  VP_MIN,
  VP_MAX,
  BONUS_POINT,
  buildAdminSnapshot,
  calcVotePoint,
  calcLiveScore,
  createEmptyResultsForCategory,
  getVoteWindowStatus,
  isMainVotingPeriod,
  isVoteSubmissionAllowed,
  readAllResults,
  readEventImpressions,
  readLiveScores,
  readResults,
  readVoteLog,
  recordBulkVotes,
  resetAllVotes,
  saveLiveScores,
};
