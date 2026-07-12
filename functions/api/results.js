import {
  calcIndividualAwardBonuses,
  calcPublicFinalResults,
  getVoteWindowStatus,
  isPublicResultsPublished,
  readAllResults,
  readLiveScores,
  RESULTS_PUBLISH_ISO,
} from "./_lib/vote-store.js";
import { CATEGORIES, MEMBERS, TEAMS } from "./_lib/vote-categories.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet(context) {
  const results = await readAllResults(context.env);
  const status = getVoteWindowStatus();
  const published = isPublicResultsPublished();
  const liveScores = published ? await readLiveScores(context.env) : null;
  const publicResults = published
    ? results
    : (status === "closed" ? {} : { team: results.team });
  const individualAwardBonuses = published
    ? calcIndividualAwardBonuses(results)
    : calcIndividualAwardBonuses({});

  return json({
    ok: true,
    status,
    resultsPublishAt: RESULTS_PUBLISH_ISO,
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
    individualAwardBonuses,
    finalResults: published ? calcPublicFinalResults(results, liveScores) : null,
    results: publicResults,
  });
}
