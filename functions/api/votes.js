import {
  getVoteWindowStatus,
  isVoteSubmissionAllowed,
  readAllResults,
  recordBulkVotes,
} from "./_lib/vote-store.js";
import { isAdminAuthorized } from "./_lib/admin-auth.js";
import {
  CATEGORIES,
  CATEGORY_IDS,
  INDIVIDUAL_CATEGORY_IDS,
  isValidCandidateForCategory,
} from "./_lib/vote-categories.js";
import { isBonusKeywordMatch } from "./_lib/bonus-keyword.js";

const MAX_NAME_LEN = 30;
const MAX_COMMENT_LEN = 100;
const MAX_EVENT_COMMENT_LEN = 300;
const MAX_BONUS_KEYWORD_LEN = 100;

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function badRequest(message) {
  return json({ ok: false, error: message }, { status: 400 });
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") return { error: "Invalid payload." };

  const voterName = String(body.voterName || "").trim();
  if (!voterName) return { error: "Name is required." };
  if (voterName.length > MAX_NAME_LEN) return { error: "Name is too long." };

  if (!Array.isArray(body.picks)) return { error: "picks must be an array." };
  if (body.picks.length !== CATEGORY_IDS.length) {
    return { error: "picks must include all categories." };
  }

  const seenCategories = new Set();
  const normalizedPicks = [];
  for (const raw of body.picks) {
    if (!raw || typeof raw !== "object") return { error: "Invalid pick entry." };
    const cid = String(raw.categoryId || "");
    if (!CATEGORY_IDS.includes(cid)) return { error: `Unknown category: ${cid}` };
    if (seenCategories.has(cid)) return { error: `Duplicate category: ${cid}` };
    seenCategories.add(cid);

    const candidateId = Number(raw.candidateId);
    if (!isValidCandidateForCategory(cid, candidateId)) {
      return { error: `Invalid candidate for category ${cid}.` };
    }

    const comment = String(raw.comment || "").trim();
    if (comment.length > MAX_COMMENT_LEN) return { error: `Comment too long for ${cid}.` };

    normalizedPicks.push({ categoryId: cid, candidateId, comment });
  }

  // 個人賞は同じ人物を複数賞に選択不可
  const individualCandidates = normalizedPicks
    .filter((p) => INDIVIDUAL_CATEGORY_IDS.includes(p.categoryId))
    .map((p) => p.candidateId);
  const uniqueCount = new Set(individualCandidates).size;
  if (uniqueCount !== individualCandidates.length) {
    return { error: "Individual award picks must be distinct people." };
  }

  const eventComment = String(body.eventComment || "").trim();
  if (eventComment.length > MAX_EVENT_COMMENT_LEN) {
    return { error: "Event comment too long." };
  }

  const bonusKeyword = String(body.bonusKeyword || "").trim();
  if (bonusKeyword.length > MAX_BONUS_KEYWORD_LEN) {
    return { error: "Bonus keyword is too long." };
  }

  return {
    payload: {
      voterName,
      picks: normalizedPicks,
      eventComment,
      bonusKeyword,
    },
  };
}

export async function onRequestPost(context) {
  const status = getVoteWindowStatus();
  const testSubmissionAllowed =
    status === "waiting" && isAdminAuthorized(context.request, context.env);
  if (!isVoteSubmissionAllowed() && !testSubmissionAllowed) {
    return json(
      {
        ok: false,
        error: status === "closed" ? "Voting is closed." : "Voting is not open yet.",
        status,
      },
      { status: 403 }
    );
  }

  const body = await context.request.json().catch(() => null);
  const result = normalizePayload(body);
  if (result.error) return badRequest(result.error);
  const { payload } = result;
  // タイムスタンプはサーバー時刻に固定（クライアント入力は信用しない）
  payload.timestamp = new Date().toISOString();

  const ip =
    context.request.headers.get("CF-Connecting-IP") ||
    context.request.headers.get("x-forwarded-for") ||
    "unknown-ip";
  const userAgent = context.request.headers.get("user-agent") || "unknown-ua";
  const acceptLanguage = context.request.headers.get("accept-language") || "unknown-lang";
  const fingerprint = await sha256(`${ip}|${userAgent}|${acceptLanguage}`);
  const expectedBonusKeyword = String(context.env.BONUS_KEYWORD || "").trim();
  const submittedBonusKeyword = String(payload.bonusKeyword || "").trim();
  // env 照合のみの結果（時間判定なし）。テストモード時の burst 演出判定用にレスポンスへ乗せる。
  const bonusKeywordMatched = isBonusKeywordMatch(submittedBonusKeyword, expectedBonusKeyword);

  const writeResult = await recordBulkVotes(
    context.env,
    fingerprint,
    payload,
    { bonusKeywordMatched }
  );

  if (!writeResult.ok && writeResult.duplicate) {
    return json(
      {
        ok: false,
        error: "This device has already voted.",
        duplicate: true,
        conflicts: writeResult.conflicts,
        existing: writeResult.existing,
        results: await readAllResults(context.env),
      },
      { status: 409 }
    );
  }

  return json({
    ok: true,
    duplicate: false,
    results: writeResult.results,
    // 実加算されたか（env 一致 かつ 本投票期間内）。本番フローでは burst 発動条件。
    bonusGranted: Boolean(writeResult.bonusGranted),
    // env 一致のみ（時間判定なし）。テストモード時の burst 演出判定用。
    bonusKeywordMatched,
  });
}
