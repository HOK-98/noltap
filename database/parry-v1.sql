-- 기존 Playbox DB(database/schema.sql 또는 migrate-v2.sql 실행 완료)에 한 번 실행하세요.
-- 기존 누르지 마! 기록 테이블을 수정하지 않고 PARRY 전용 테이블만 추가합니다.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS parry_daily_challenges (
  challenge_date DATE NOT NULL,
  seed BIGINT UNSIGNED NOT NULL,
  rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (challenge_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parry_runs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  run_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mode ENUM('survival','daily') NOT NULL,
  challenge_date DATE NULL,
  seed BIGINT UNSIGNED NOT NULL,
  rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('active','verified','abandoned') NOT NULL DEFAULT 'active',
  bosses_defeated SMALLINT UNSIGNED NULL,
  last_boss_parries SMALLINT UNSIGNED NULL,
  score INT UNSIGNED NULL,
  perfect_rate DECIMAL(5,2) NULL,
  best_combo SMALLINT UNSIGNED NULL,
  perfect_count SMALLINT UNSIGNED NULL,
  good_count SMALLINT UNSIGNED NULL,
  miss_count SMALLINT UNSIGNED NULL,
  total_attacks SMALLINT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  events_json MEDIUMTEXT NULL,
  started_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_parry_runs_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  KEY idx_parry_rank (mode, challenge_date, rules_version, status, bosses_defeated, last_boss_parries, score, perfect_rate),
  KEY idx_parry_player_best (player_id, mode, challenge_date, rules_version, status, bosses_defeated, score),
  KEY idx_parry_active (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
