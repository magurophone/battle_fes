import { getAdminPrincipal, unauthorizedAdminResponse } from "../_lib/admin-auth.js";
import { buildAdminResponse } from "../_lib/admin-response.js";
import {
  buildAdminSnapshot,
  getAdminEffectiveVoteWindowStatus,
  getAdminVoteStatusOverride,
} from "../_lib/vote-store.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet(context) {
  const principal = getAdminPrincipal(context.request, context.env);
  if (!principal) return unauthorizedAdminResponse();

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
