const TEAM_IDS = [1, 2, 3, 4];
const RESULTS_KEY = "vote-results";
const FINGERPRINT_PREFIX = "vote-fingerprint:";
const META_KEY = "vote-meta";
const LOG_KEY = "vote-log";
const MAX_LOG_ENTRIES = 500;

function createEmptyResults() {
  const counts = {};
  for (const id of TEAM_IDS) counts[id] = 0;

  return {
    counts,
    totalVotes: 0,
    updatedAt: null,
  };
}

function normalizeResults(results) {
  const normalized = createEmptyResults();
  const sourceCounts = results && typeof results === "object" ? results.counts || {} : {};

  for (const id of TEAM_IDS) {
    const value = Number(sourceCounts[id] ?? sourceCounts[String(id)] ?? 0);
    normalized.counts[id] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  normalized.totalVotes = Object.values(normalized.counts).reduce((sum, value) => sum + value, 0);
  normalized.updatedAt = results && results.updatedAt ? results.updatedAt : null;
  return normalized;
}

async function readResults(store) {
  if (!store) return createEmptyResults();

  const raw = await store.get(RESULTS_KEY);
  if (!raw) return createEmptyResults();

  try {
    return normalizeResults(JSON.parse(raw));
  } catch {
    return createEmptyResults();
  }
}

async function writeResults(store, results) {
  await store.put(RESULTS_KEY, JSON.stringify(normalizeResults(results)));
}

async function readMeta(store) {
  if (!store) return { totalSubmissions: 0, lastVoteAt: null };

  const raw = await store.get(META_KEY);
  if (!raw) return { totalSubmissions: 0, lastVoteAt: null };

  try {
    const parsed = JSON.parse(raw);
    return {
      totalSubmissions: Number(parsed.totalSubmissions) || 0,
      lastVoteAt: parsed.lastVoteAt || null,
    };
  } catch {
    return { totalSubmissions: 0, lastVoteAt: null };
  }
}

async function writeMeta(store, meta) {
  await store.put(
    META_KEY,
    JSON.stringify({
      totalSubmissions: Number(meta.totalSubmissions) || 0,
      lastVoteAt: meta.lastVoteAt || null,
    })
  );
}

async function readVoteLog(store) {
  if (!store) return [];

  const raw = await store.get(LOG_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeVoteLog(store, entries) {
  const normalized = Array.isArray(entries) ? entries.slice(0, MAX_LOG_ENTRIES) : [];
  await store.put(LOG_KEY, JSON.stringify(normalized));
}

async function findExistingVote(store, fingerprint) {
  if (!store) return null;

  const raw = await store.get(`${FINGERPRINT_PREFIX}${fingerprint}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function recordVote(store, fingerprint, payload) {
  if (!store) {
    throw new Error("Vote storage binding is not configured.");
  }

  const existing = await findExistingVote(store, fingerprint);
  if (existing) {
    return {
      ok: false,
      duplicate: true,
      existing,
      results: await readResults(store),
    };
  }

  const results = await readResults(store);
  const meta = await readMeta(store);
  const voteLog = await readVoteLog(store);
  results.counts[payload.teamId] = (results.counts[payload.teamId] || 0) + 1;
  results.totalVotes += 1;
  results.updatedAt = new Date().toISOString();
  meta.totalSubmissions += 1;
  meta.lastVoteAt = payload.timestamp;

  voteLog.unshift({
    teamId: payload.teamId,
    voterName: payload.voterName,
    comment: payload.comment,
    timestamp: payload.timestamp,
  });

  await Promise.all([
    writeResults(store, results),
    writeMeta(store, meta),
    writeVoteLog(store, voteLog),
    store.put(
      `${FINGERPRINT_PREFIX}${fingerprint}`,
      JSON.stringify({
        teamId: payload.teamId,
        votedAt: payload.timestamp,
      })
    ),
  ]);

  return {
    ok: true,
    duplicate: false,
    results,
  };
}

async function listFingerprints(store) {
  const keys = [];
  let cursor = undefined;

  do {
    const page = await store.list({ prefix: FINGERPRINT_PREFIX, cursor });
    keys.push(...page.keys.map((entry) => entry.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return keys;
}

async function buildAdminSnapshot(store) {
  const [results, meta, fingerprintKeys, voteLog] = await Promise.all([
    readResults(store),
    readMeta(store),
    listFingerprints(store),
    readVoteLog(store),
  ]);

  return {
    results,
    meta,
    uniqueFingerprints: fingerprintKeys.length,
    voteLog,
  };
}

async function resetAllVotes(store) {
  if (!store) {
    throw new Error("Vote storage binding is not configured.");
  }

  const fingerprintKeys = await listFingerprints(store);
  const keysToDelete = [RESULTS_KEY, META_KEY, LOG_KEY, ...fingerprintKeys];

  await Promise.all(keysToDelete.map((key) => store.delete(key)));

  return createEmptyResults();
}

function getVoteWindowStatus() {
  const VOTE_OPEN = null;
  const VOTE_CLOSE = null;

  if (!VOTE_OPEN || !VOTE_CLOSE) return "waiting";

  const now = Date.now();
  const openAt = new Date(VOTE_OPEN).getTime();
  const closeAt = new Date(VOTE_CLOSE).getTime();

  if (now < openAt) return "waiting";
  if (now > closeAt) return "closed";
  return "open";
}

function isVoteSubmissionAllowed() {
  const status = getVoteWindowStatus();
  return status === "open" || status === "waiting";
}

export {
  TEAM_IDS,
  buildAdminSnapshot,
  createEmptyResults,
  getVoteWindowStatus,
  isVoteSubmissionAllowed,
  readResults,
  readVoteLog,
  recordVote,
  resetAllVotes,
};
