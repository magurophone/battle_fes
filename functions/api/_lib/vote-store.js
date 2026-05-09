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

function createEmptyResultsForCategory(category) {
  const counts = {};
  for (const id of category.candidateIds) counts[id] = 0;
  return { counts, totalVotes: 0, updatedAt: null };
}

function normalizeResults(category, raw) {
  const fresh = createEmptyResultsForCategory(category);
  const sourceCounts = raw && typeof raw === "object" ? raw.counts || {} : {};
  for (const id of category.candidateIds) {
    const v = Number(sourceCounts[id] ?? sourceCounts[String(id)] ?? 0);
    fresh.counts[id] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  fresh.totalVotes = Object.values(fresh.counts).reduce((s, v) => s + v, 0);
  fresh.updatedAt = raw && raw.updatedAt ? raw.updatedAt : null;
  return fresh;
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
  if (!store) return [];
  const raw = await store.get(`${LOG_PREFIX}${categoryId}`);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
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
async function recordBulkVotes(store, fingerprint, payload) {
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

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const cid = pick.categoryId;
    const candId = Number(pick.candidateId);
    const result = results[i];
    const meta = metas[i];
    const log = logs[i];

    result.counts[candId] = (result.counts[candId] || 0) + 1;
    result.totalVotes += 1;
    result.updatedAt = now;

    meta.totalSubmissions += 1;
    meta.lastVoteAt = now;

    log.unshift({
      categoryId: cid,
      candidateId: candId,
      voterName: payload.voterName,
      comment: pick.comment || "",
      timestamp: now,
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
  const VOTE_OPEN = "2026-07-18T20:45:00+09:00";
  const VOTE_CLOSE = "2026-07-18T22:25:00+09:00";
  if (!VOTE_OPEN || !VOTE_CLOSE) return "waiting";
  const now = Date.now();
  const openAt = new Date(VOTE_OPEN).getTime();
  const closeAt = new Date(VOTE_CLOSE).getTime();
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
  buildAdminSnapshot,
  createEmptyResultsForCategory,
  getVoteWindowStatus,
  isVoteSubmissionAllowed,
  readAllResults,
  readEventImpressions,
  readResults,
  readVoteLog,
  recordBulkVotes,
  resetAllVotes,
};
