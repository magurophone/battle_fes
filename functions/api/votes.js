import { createEmptyResults, getVoteWindowStatus, isVoteSubmissionAllowed, recordVote } from "./_lib/vote-store.js";

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function badRequest(message) {
  return json({ ok: false, error: message, results: createEmptyResults() }, { status: 400 });
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") return null;

  const teamId = Number(body.teamId);
  const voterName = String(body.voterName || "").trim();
  const comment = String(body.comment || "").trim();
  const timestamp = String(body.timestamp || new Date().toISOString());

  if (![1, 2, 3, 4].includes(teamId)) return null;
  if (!voterName || voterName.length > 30) return null;
  if (comment.length > 100) return null;

  return { teamId, voterName, comment, timestamp };
}

export async function onRequestPost(context) {
  const status = getVoteWindowStatus();
  if (!isVoteSubmissionAllowed()) {
    return json(
      {
        ok: false,
        error: status === "closed" ? "Voting is closed." : "Voting is not open yet.",
        status,
      },
      { status: 403 }
    );
  }

  const payload = normalizePayload(await context.request.json().catch(() => null));
  if (!payload) return badRequest("Invalid vote payload.");

  const ip =
    context.request.headers.get("CF-Connecting-IP") ||
    context.request.headers.get("x-forwarded-for") ||
    "unknown-ip";
  const userAgent = context.request.headers.get("user-agent") || "unknown-ua";
  const acceptLanguage = context.request.headers.get("accept-language") || "unknown-lang";
  const fingerprint = await sha256(`${ip}|${userAgent}|${acceptLanguage}`);

  const result = await recordVote(context.env.BATTLE_FES_VOTE_STORE, fingerprint, payload);

  if (!result.ok && result.duplicate) {
    return json(
      {
        ok: false,
        error: "This device has already voted.",
        duplicate: true,
        existingTeamId: result.existing.teamId,
        results: result.results,
      },
      { status: 409 }
    );
  }

  return json({
    ok: true,
    duplicate: false,
    results: result.results,
  });
}
