import {
  CATEGORIES,
  CATEGORY_IDS,
  getCategory,
} from "./vote-categories.js";

const RESULTS_PREFIX = "vote-results:";
const META_PREFIX = "vote-meta:";
const LOG_PREFIX = "vote-log:";
const FINGERPRINT_PREFIX = "vote-fingerprint:";
const EVENT_IMPRESSIONS_KEY = "event-impressions-log";
const MAX_LOG_ENTRIES = 500;
const MAX_EVENT_IMPRESSIONS = 1000;

// 投票時間ウィンドウとポイント計算 (public 側 VOTE POWER と同一仕様)
// 受付開始 100PT → 本投票直前 5000PT への線形上昇
const VOTE_OPEN_ISO = "2026-07-18T20:45:00+09:00";
const VOTE_CLOSE_ISO = "2026-07-18T22:25:00+09:00";
// 本投票時間: 22:15-22:25 の 10 分間 (この時間のみ貫通 BONUS のキーワード入力可能)
const MAIN_VOTE_OPEN_ISO = "2026-07-18T22:15:00+09:00";
const VP_MIN = 100;
const VP_MAX = 5000;
// 貫通 BONUS: 本投票時間中に正解キーワードを入力した投票に付与される追加ポイント
const BONUS_POINT = 5000;

function calcVotePoint(iso) {
  if (!iso) return VP_MIN;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return VP_MIN;
  const open = new Date(VOTE_OPEN_ISO).getTime();
  const close = new Date(VOTE_CLOSE_ISO).getTime();
  if (t <= open) return VP_MIN;
  if (t >= close) return VP_MAX;
  const progress = (t - open) / (close - open);
  return Math.round(VP_MIN + (VP_MAX - VP_MIN) * progress);
}

// 本投票時間内かどうか (キーワード入力受付期間)
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

function normalizeResults(category, raw) {
  const fresh = createEmptyResultsForCategory(category);
  const sourceCounts = raw && typeof raw === "object" ? raw.counts || {} : {};
  const sourcePoints = raw && typeof raw === "object" ? raw.points || {} : {};
  for (const id of category.candidateIds) {
    const v = Number(sourceCounts[id] ?? sourceCounts[String(id)] ?? 0);
    fresh.counts[id] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    fresh.points[id] = normalizeStoredPoint(
      sourcePoints[id] ?? sourcePoints[String(id)] ?? 0
    );
  }
  fresh.totalVotes = Object.values(fresh.counts).reduce((s, v) => s + v, 0);
  const summedPoints = Object.values(fresh.points).reduce((s, v) => s + v, 0);
  fresh.totalPoints = normalizeStoredPoint(raw && raw.totalPoints, summedPoints);
  fresh.bonusCount = normalizeStoredPoint(raw && raw.bonusCount, 0);
  fresh.updatedAt = raw && raw.updatedAt ? raw.updatedAt : null;
  return raw && typeof raw === "object" ? { ...raw, ...fresh } : fresh;
}

async function readResults(store, categoryId) {
  const cat = getCategory(categoryId);
  if (!cat) return null;
  if (!store) return createEmptyResultsForCategory(cat);
  const raw = await store.get(`${RESULTS_PREFIX}${categoryId}`);
  if (!raw) return createEmptyResultsForCategory(cat);
  try {
    return normalizeResults(cat, JSON.parse(raw));
  } catch {
    return createEmptyResultsForCategory(cat);
  }
}

async function readAllResults(store) {
  const out = {};
  await Promise.all(
    CATEGORIES.map(async (c) => {
      out[c.id] = await readResults(store, c.id);
    })
  );
  return out;
}

async function readMeta(store, categoryId) {
  if (!store) return { totalSubmissions: 0, lastVoteAt: null };
  const raw = await store.get(`${META_PREFIX}${categoryId}`);
  if (!raw) return { totalSubmissions: 0, lastVoteAt: null };
  try {
    const p = JSON.parse(raw);
    return {
      totalSubmissions: Number(p.totalSubmissions) || 0,
      lastVoteAt: p.lastVoteAt || null,
    };
  } catch {
    return { totalSubmissions: 0, lastVoteAt: null };
  }
}

async function readVoteLog(store, categoryId) {
  const category = getCategory(categoryId);
  if (!store) return [];
  const raw = await store.get(`${LOG_PREFIX}${categoryId}`);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.map((entry) => ({
      ...entry,
      votePoint: normalizeStoredPoint(
        entry && entry.votePoint,
        category ? calcVotePoint(entry && entry.timestamp) : 0
      ),
      bonusPoint: normalizeStoredPoint(entry && entry.bonusPoint, 0),
      bonusGranted:
        typeof (entry && entry.bonusGranted) === "boolean"
          ? entry.bonusGranted
          : normalizeStoredPoint(entry && entry.bonusPoint, 0) > 0,
    }));
  } catch {
    return [];
  }
}

async function readEventImpressions(store) {
  if (!store) return [];
  const raw = await store.get(EVENT_IMPRESSIONS_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

async function findExistingFingerprints(store, fingerprint, categoryIds) {
  if (!store) {
    return Object.fromEntries(categoryIds.map((id) => [id, null]));
  }
  const out = {};
  await Promise.all(
    categoryIds.map(async (cid) => {
      const raw = await store.get(`${FINGERPRINT_PREFIX}${cid}:${fingerprint}`);
      if (!raw) {
        out[cid] = null;
        return;
      }
      try {
        out[cid] = JSON.parse(raw);
      } catch {
        out[cid] = { existed: true };
      }
    })
  );
  return out;
}

// payload: { voterName, picks: [{categoryId, candidateId, comment?}], eventComment?, timestamp }
// opts: { bonusGranted?: boolean }  貫通 BONUS 判定済みフラグ (votes.js で env と照合済み)
async function recordBulkVotes(store, fingerprint, payload, opts = {}) {
  if (!store) throw new Error("Vote storage binding is not configured.");

  const picks = payload.picks;
  const categoryIds = picks.map((p) => p.categoryId);

  const existing = await findExistingFingerprints(store, fingerprint, categoryIds);
  const conflicts = categoryIds.filter((cid) => existing[cid] !== null);
  if (conflicts.length > 0) {
    return { ok: false, duplicate: true, conflicts, existing };
  }

  const [results, metas, logs, impressions] = await Promise.all([
    Promise.all(categoryIds.map((cid) => readResults(store, cid))),
    Promise.all(categoryIds.map((cid) => readMeta(store, cid))),
    Promise.all(categoryIds.map((cid) => readVoteLog(store, cid))),
    readEventImpressions(store),
  ]);

  // votes.js が必ずサーバ時刻で上書きする想定だが、別経路から呼ばれた場合の防御。
  // 文字列以外（オブジェクト等）が入ってきた場合もサーバ時刻にフォールバック。
  const now =
    typeof payload.timestamp === "string" && payload.timestamp.trim()
      ? payload.timestamp.trim()
      : new Date().toISOString();
  const writes = [];

  // 投票成立時のポイントを 1 度だけ算出して全カテゴリで共有
  const votePoint = calcVotePoint(now);
  // 貫通 BONUS: votes.js で env キーワードと照合済み + 本投票期間内なら 5000pt 加算
  const bonusPoint = opts.bonusGranted && isMainVotingPeriod(now) ? BONUS_POINT : 0;
  const totalPointPerVote = votePoint + bonusPoint;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const cid = pick.categoryId;
    const candId = Number(pick.candidateId);
    const result = results[i];
    const meta = metas[i];
    const log = logs[i];

    result.counts[candId] = (result.counts[candId] || 0) + 1;
    result.points = result.points || {};
    result.points[candId] = (result.points[candId] || 0) + totalPointPerVote;
    result.totalVotes += 1;
    result.totalPoints = (result.totalPoints || 0) + totalPointPerVote;
    if (bonusPoint > 0) {
      result.bonusCount = (result.bonusCount || 0) + 1;
    }
    result.updatedAt = now;

    meta.totalSubmissions += 1;
    meta.lastVoteAt = now;

    log.unshift({
      categoryId: cid,
      candidateId: candId,
      voterName: payload.voterName,
      comment: pick.comment || "",
      timestamp: now,
      votePoint,
      bonusPoint,
      bonusGranted: bonusPoint > 0,
    });

    writes.push(store.put(`${RESULTS_PREFIX}${cid}`, JSON.stringify(result)));
    writes.push(store.put(`${META_PREFIX}${cid}`, JSON.stringify(meta)));
    writes.push(
      store.put(`${LOG_PREFIX}${cid}`, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)))
    );
    writes.push(
      store.put(
        `${FINGERPRINT_PREFIX}${cid}:${fingerprint}`,
        JSON.stringify({ candidateId: candId, votedAt: now })
      )
    );
  }

  const eventComment = String(payload.eventComment || "").trim();
  if (eventComment) {
    impressions.unshift({
      voterName: payload.voterName,
      comment: eventComment,
      timestamp: now,
    });
    writes.push(
      store.put(
        EVENT_IMPRESSIONS_KEY,
        JSON.stringify(impressions.slice(0, MAX_EVENT_IMPRESSIONS))
      )
    );
  }

  await Promise.all(writes);

  return {
    ok: true,
    duplicate: false,
    votePoint,
    bonusPoint,
    bonusGranted: bonusPoint > 0,
    results: Object.fromEntries(categoryIds.map((cid, i) => [cid, results[i]])),
  };
}

async function listKeysWithPrefix(store, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix, cursor });
    keys.push(...page.keys.map((e) => e.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function buildAdminSnapshot(store) {
  const categories = {};
  await Promise.all(
    CATEGORIES.map(async (c) => {
      const [results, meta, voteLog, fingerprintKeys] = await Promise.all([
        readResults(store, c.id),
        readMeta(store, c.id),
        readVoteLog(store, c.id),
        listKeysWithPrefix(store, `${FINGERPRINT_PREFIX}${c.id}:`),
      ]);
      categories[c.id] = {
        results,
        meta,
        voteLog,
        uniqueFingerprints: fingerprintKeys.length,
      };
    })
  );
  const eventImpressions = await readEventImpressions(store);
  return { categories, eventImpressions };
}

// 旧スキーマで残ったキー（接尾辞なしの単票時代）も含めてゴミ掃除する
const LEGACY_KEYS = ["vote-results", "vote-meta", "vote-log"];

async function resetAllVotes(store) {
  if (!store) throw new Error("Vote storage binding is not configured.");
  const keysToDelete = new Set();
  for (const cid of CATEGORY_IDS) {
    keysToDelete.add(`${RESULTS_PREFIX}${cid}`);
    keysToDelete.add(`${META_PREFIX}${cid}`);
    keysToDelete.add(`${LOG_PREFIX}${cid}`);
  }
  keysToDelete.add(EVENT_IMPRESSIONS_KEY);
  for (const k of LEGACY_KEYS) keysToDelete.add(k);

  // すべての vote-fingerprint:* キー（カテゴリ別の新スキーマ + 旧スキーマ両方）を一括削除
  const allFingerprintKeys = await listKeysWithPrefix(store, FINGERPRINT_PREFIX);
  for (const k of allFingerprintKeys) keysToDelete.add(k);

  await Promise.all([...keysToDelete].map((k) => store.delete(k)));
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

// テストモード（admin 画面で localStorage トグル）から本番前に投票送信できるよう、
// VOTE_OPEN 前の "waiting" もサーバ側では許可している。"closed"（VOTE_CLOSE 後）は弾く。
// 一般ユーザーへの遮断は public ページのカウントダウン UI 側で行う前提。
// テストモード ON のときだけブラウザ側で UI ゲートが解除される。
function isVoteSubmissionAllowed() {
  const status = getVoteWindowStatus();
  return status === "open" || status === "waiting";
}

export {
  CATEGORIES,
  CATEGORY_IDS,
  VOTE_OPEN_ISO,
  VOTE_CLOSE_ISO,
  MAIN_VOTE_OPEN_ISO,
  VP_MIN,
  VP_MAX,
  BONUS_POINT,
  buildAdminSnapshot,
  calcVotePoint,
  createEmptyResultsForCategory,
  getVoteWindowStatus,
  isMainVotingPeriod,
  isVoteSubmissionAllowed,
  readAllResults,
  readEventImpressions,
  readResults,
  readVoteLog,
  recordBulkVotes,
  resetAllVotes,
};
