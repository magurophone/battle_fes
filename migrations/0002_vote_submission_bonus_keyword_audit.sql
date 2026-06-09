ALTER TABLE vote_submissions
  ADD COLUMN bonus_keyword_submitted TEXT NOT NULL DEFAULT '';

ALTER TABLE vote_submissions
  ADD COLUMN bonus_keyword_matched INTEGER NOT NULL DEFAULT 0;
