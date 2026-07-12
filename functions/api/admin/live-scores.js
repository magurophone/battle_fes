import { getAdminPrincipal, unauthorizedAdminResponse } from "../_lib/admin-auth.js";
import { buildAdminResponse } from "../_lib/admin-response.js";
import {
  buildAdminSnapshot,
  getAdminEffectiveVoteWindowStatus,
  getAdminVoteStatusOverride,
  saveLiveScores,
} from "../_lib/vote-store.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestPost(context) {
  const principal = getAdminPrincipal(context.request, context.env);
  if (!principal) return unauthorizedAdminResponse();

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  await saveLiveScores(context.env, body);
  const [snapshot, status, voteStatusOverride] = await Promise.all([
    buildAdminSnapshot(context.env),
    getAdminEffectiveVoteWindowStatus(context.env),
    getAdminVoteStatusOverride(context.env),
  ]);

  return json(buildAdminResponse({
    status,
    voteStatusOverride,
    principal,
    snapshot,
  }));
}
