import { createEmptyResults, getVoteWindowStatus, readResults } from "./_lib/vote-store.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet(context) {
  const results = await readResults(context.env.BATTLE_FES_VOTE_STORE);

  return json({
    ok: true,
    status: getVoteWindowStatus(),
    results: results || createEmptyResults(),
  });
}
