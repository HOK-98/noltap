-- Hostinger phpMyAdmin에서 사용할 데이터베이스를 먼저 선택한 뒤 실행하세요.
-- 기본 문자셋: utf8mb4 (한글 닉네임 지원)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nickname VARCHAR(64) NOT NULL DEFAULT '플레이어',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_key_hash (player_key_hash),
  KEY idx_players_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_challenges (
  challenge_date DATE NOT NULL,
  seed BIGINT UNSIGNED NOT NULL,
  rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (challenge_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_runs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  run_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mode ENUM('survival', 'daily') NOT NULL,
  challenge_date DATE NULL,
  seed BIGINT UNSIGNED NOT NULL,
  rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  status ENUM('active', 'verified', 'abandoned') NOT NULL DEFAULT 'active',
  stage SMALLINT UNSIGNED NULL,
  score INT UNSIGNED NULL,
  accuracy DECIMAL(5,2) NULL,
  avg_reaction_ms SMALLINT UNSIGNED NULL,
  best_reaction_ms SMALLINT UNSIGNED NULL,
  best_combo SMALLINT UNSIGNED NULL,
  mistakes TINYINT UNSIGNED NULL,
  correct_count SMALLINT UNSIGNED NULL,
  wrong_count SMALLINT UNSIGNED NULL,
  timeout_count SMALLINT UNSIGNED NULL,
  questions_processed SMALLINT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  events_json MEDIUMTEXT NULL,
  started_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_game_runs_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  KEY idx_runs_rank_all (mode, challenge_date, rules_version, status, questions_processed, score, accuracy),
  KEY idx_runs_player_best (player_id, mode, challenge_date, rules_version, status, questions_processed, score),
  KEY idx_runs_active (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  route_key VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  window_started DATETIME NOT NULL,
  hit_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, route_key),
  KEY idx_rate_window (window_started)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
