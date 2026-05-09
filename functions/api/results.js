import { getVoteWindowStatus, readAllResults } from "./_lib/vote-store.js";
import { CATEGORIES, MEMBERS, TEAMS } from "./_lib/vote-categories.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet(context) {
  const results = await readAllResults(context.env.BATTLE_FES_VOTE_STORE);

  return json({
    ok: true,
    status: getVoteWindowStatus(),
    config: {
      categories: CATEGORIES.map((c) => ({
        id: c.id,
        type: c.type,
        label: c.label,
        candidateType: c.candidateType,
        candidateIds: c.candidateIds,
      })),
      teams: TEAMS,
      members: MEMBERS,
    },
    results,
  });
}
