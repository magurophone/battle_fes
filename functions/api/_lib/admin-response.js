import { CATEGORIES, MEMBERS, TEAMS } from "./vote-categories.js";

const LEADER_RESULTS_UNLOCK_ISO = "2026-07-18T22:50:00+09:00";

function snapshotConfig() {
  return {
    categories: CATEGORIES.map((category) => ({
      id: category.id,
      type: category.type,
      label: category.label,
      candidateType: category.candidateType,
      candidateIds: category.candidateIds,
    })),
    teams: TEAMS,
    members: MEMBERS,
  };
}

function areLeaderResultsUnlocked(now = Date.now()) {
  const unlockAt = new Date(LEADER_RESULTS_UNLOCK_ISO).getTime();
  const current = now instanceof Date ? now.getTime() : Number(now);
  return Number.isFinite(unlockAt) && Number.isFinite(current) && current >= unlockAt;
}

function accessPayload(principal) {
  const owner = principal?.role === "owner";
  const leaderResultsUnlocked = !owner && areLeaderResultsUnlocked();
  return {
    role: owner ? "owner" : "leader",
    canViewResults: owner || leaderResultsUnlocked,
    canManageVotes: owner,
    canEditLiveScores: true,
    resultsUnlockAt: LEADER_RESULTS_UNLOCK_ISO,
  };
}

function buildAdminResponse({ snapshot, status, voteStatusOverride, principal }) {
  const access = accessPayload(principal);
  const common = {
    ok: true,
    status,
    access,
    config: snapshotConfig(),
    liveScores: snapshot.liveScores,
  };

  if (!access.canViewResults) {
    return {
      ...common,
      adminVoteStatusOverride: null,
      categories: {},
      eventImpressions: [],
      individualAwardBonuses: {
        pointPerAward: 0,
        teamScores: {},
        totalPoints: 0,
        awards: [],
      },
      finalResults: null,
    };
  }

  return {
    ...common,
    adminVoteStatusOverride: access.canManageVotes ? (voteStatusOverride || null) : null,
    categories: snapshot.categories,
    eventImpressions: snapshot.eventImpressions,
    individualAwardBonuses: snapshot.individualAwardBonuses,
    finalResults: snapshot.finalResults,
  };
}

export {
  LEADER_RESULTS_UNLOCK_ISO,
  areLeaderResultsUnlocked,
  buildAdminResponse,
  snapshotConfig,
};
