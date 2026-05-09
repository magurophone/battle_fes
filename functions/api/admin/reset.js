import { requireAdmin } from "../_lib/admin-auth.js";
import {
  buildAdminSnapshot,
  getVoteWindowStatus,
  resetAllVotes,
} from "../_lib/vote-store.js";
import { CATEGORIES, MEMBERS, TEAMS } from "../_lib/vote-categories.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function snapshotConfig() {
  return {
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      type: c.type,
      label: c.label,
      candidateType: c.candidateType,
      candidateIds: c.candidateIds,
    })),
    teams: TEAMS,
    members: MEMBERS,
  };
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context.request, context.env);
  if (unauthorized) return unauthorized;

  await resetAllVotes(context.env.BATTLE_FES_VOTE_STORE);
  const snapshot = await buildAdminSnapshot(context.env.BATTLE_FES_VOTE_STORE);

  return json({
    ok: true,
    status: getVoteWindowStatus(),
    config: snapshotConfig(),
    ...snapshot,
  });
}
