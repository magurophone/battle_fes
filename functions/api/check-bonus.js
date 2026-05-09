/**
 * 貫通 BONUS キーワード検証 (リアルタイム演出用)
 *
 * フロントが入力欄に文字を打ったタイミング (or 確認ボタン) で叩く。
 * - request body: { keyword: string }
 * - response: { ok: true, valid: boolean }
 *
 * セキュリティ:
 * - 正解キーワードは Cloudflare 環境変数 BONUS_KEYWORD (secret) のみが知る。
 * - 本エンドポイントは正解そのものを返さず、true/false のみを返す。
 * - 投票送信時 (POST /api/votes) でも payload.bonusKeyword を再検証してから
 *   bonusPoint を加算する (信頼境界)。本エンドポイントの結果は演出専用。
 */

import { isMainVotingPeriod } from "./_lib/vote-store.js";

const MAX_BONUS_KEYWORD_LEN = 100;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const submitted = String((body && body.keyword) || "").trim();
  if (!submitted) {
    return json({ ok: true, valid: false });
  }
  if (submitted.length > MAX_BONUS_KEYWORD_LEN) {
    return json({ ok: false, error: "Keyword too long." }, { status: 400 });
  }

  const expected = String(context.env.BONUS_KEYWORD || "").trim();
  const valid = Boolean(expected) && submitted === expected;

  // 本投票期間外でも valid 判定自体は返す (UI 側の演出で使う)。
  // ただしクライアントには現在期間内かどうかも返して、UI 表示制御に活用できるようにする。
  const inMainPeriod = isMainVotingPeriod(new Date().toISOString());

  return json({ ok: true, valid, inMainPeriod });
}
