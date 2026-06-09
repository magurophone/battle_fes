PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vote_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,
  voter_name TEXT NOT NULL,
  event_comment TEXT NOT NULL DEFAULT '',
  vote_point INTEGER NOT NULL DEFAULT 0,
  bonus_point INTEGER NOT NULL DEFAULT 0,
  bonus_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vote_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  candidate_id INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES vote_submissions(id) ON DELETE CASCADE,
  UNIQUE(submission_id, category_id)
);

CREATE TABLE IF NOT EXISTS event_impressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  voter_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES vote_submissions(id) ON DELETE CASCADE,
  UNIQUE(submission_id)
);

CREATE TABLE IF NOT EXISTS live_scores (
  member_id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL,
  oshi_bonus_percent REAL NOT NULL DEFAULT 0,
  monthly_oshi_point_in_frame INTEGER NOT NULL DEFAULT 0,
  live_score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vote_picks_category_candidate
  ON vote_picks(category_id, candidate_id);

CREATE INDEX IF NOT EXISTS idx_vote_picks_submission
  ON vote_picks(submission_id);

CREATE INDEX IF NOT EXISTS idx_vote_submissions_created_at
  ON vote_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_event_impressions_created_at
  ON event_impressions(created_at);

CREATE INDEX IF NOT EXISTS idx_live_scores_team
  ON live_scores(team_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs(created_at);
