CREATE TABLE IF NOT EXISTS knight_runs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 stage_id SMALLINT UNSIGNED NOT NULL,
 rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
 started_ms BIGINT UNSIGNED NOT NULL,
 finished TINYINT UNSIGNED NOT NULL DEFAULT 0,
 KEY idx_knight_runs_player (player_id,started_ms),
 CONSTRAINT fk_knight_runs_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS knight_stage_records (
 player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 rules_version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
 stage_id SMALLINT UNSIGNED NOT NULL,
 stars TINYINT UNSIGNED NOT NULL,
 duration_ms INT UNSIGNED NOT NULL,
 hints SMALLINT UNSIGNED NOT NULL,
 undos SMALLINT UNSIGNED NOT NULL,
 updated_at DATETIME NOT NULL,
 PRIMARY KEY(player_id,rules_version,stage_id),
 CONSTRAINT fk_knight_records_player FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
