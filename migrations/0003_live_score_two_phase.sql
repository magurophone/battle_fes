ALTER TABLE live_scores RENAME COLUMN monthly_oshi_point_in_frame TO live_score_before;
ALTER TABLE live_scores ADD COLUMN live_score_after INTEGER NOT NULL DEFAULT 0;
