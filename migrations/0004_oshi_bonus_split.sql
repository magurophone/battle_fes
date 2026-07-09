ALTER TABLE live_scores RENAME COLUMN oshi_bonus_percent TO oshi_bonus_percent_before;
ALTER TABLE live_scores ADD COLUMN oshi_bonus_percent_after REAL NOT NULL DEFAULT 0;
