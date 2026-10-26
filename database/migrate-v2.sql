-- 기존 v1 DB에서 실행하세요. 점검 후 한 번만 실행합니다.
-- v1 랭킹 기록은 새 색상 게임 기록과 섞이지 않도록 rules_version=1로 남깁니다.

ALTER TABLE daily_challenges
  MODIFY rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 3;

ALTER TABLE game_runs
  MODIFY status ENUM('active', 'verified', 'abandoned') NOT NULL DEFAULT 'active',
  MODIFY started_at DATETIME(3) NOT NULL,
  MODIFY submitted_at DATETIME(3) NULL,
  CHANGE COLUMN signal_count questions_processed SMALLINT UNSIGNED NULL,
  ADD COLUMN rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER seed,
  ADD COLUMN best_reaction_ms SMALLINT UNSIGNED NULL AFTER avg_reaction_ms,
  ADD COLUMN correct_count SMALLINT UNSIGNED NULL AFTER mistakes,
  ADD COLUMN wrong_count SMALLINT UNSIGNED NULL AFTER correct_count,
  ADD COLUMN timeout_count SMALLINT UNSIGNED NULL AFTER wrong_count;

-- 기존 기록은 위 ADD COLUMN의 기본값 1을 유지하고, 이후 생성 기록의 기본값은 최신 규칙으로 둡니다.
ALTER TABLE game_runs
  MODIFY rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 3;

DROP INDEX idx_runs_rank_all ON game_runs;
CREATE INDEX idx_runs_rank_all
  ON game_runs (mode, challenge_date, rules_version, status, questions_processed, score, accuracy);

-- idx_runs_player_best의 첫 컬럼(player_id)은 외래 키 fk_game_runs_player를
-- 지원하고 있으므로, 대체 인덱스를 먼저 추가한 뒤 기존 인덱스를 교체합니다.
CREATE INDEX idx_game_runs_player_fk_tmp ON game_runs (player_id);
DROP INDEX idx_runs_player_best ON game_runs;
CREATE INDEX idx_runs_player_best
  ON game_runs (player_id, mode, challenge_date, rules_version, status, questions_processed, score);
DROP INDEX idx_game_runs_player_fk_tmp ON game_runs;
