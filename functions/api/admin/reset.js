import { requireAdmin } from "../_lib/admin-auth.js";
import { buildAdminSnapshot, getVoteWindowStatus, resetAllVotes } from "../_lib/vote-store.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context.request, context.env);
  if (unauthorized) return unauthorized;

  await resetAllVotes(context.env.BATTLE_FES_VOTE_STORE);
  const snapshot = await buildAdminSnapshot(context.env.BATTLE_FES_VOTE_STORE);

  return json({
    ok: true,
    status: getVoteWindowStatus(),
    ...snapshot,
  });
}
