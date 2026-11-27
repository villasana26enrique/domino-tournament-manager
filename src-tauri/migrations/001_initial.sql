-- Migración 001: Esquema inicial normalizado de Domino Tournament Manager
-- Cumple ADR-001, ADR-002, ADR-006, ADR-007 y ADR-008.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  nickname TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'individual_rotating_pairs',
  format TEXT NOT NULL CHECK (format IN ('rounds_all_play', 'qualifying_elimination')),
  scheduling_mode TEXT NOT NULL CHECK (scheduling_mode IN ('hybrid_competitive', 'fixed_schedule')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'in_progress', 'completed', 'cancelled')),
  seed TEXT NOT NULL,
  planned_rounds INTEGER NOT NULL CHECK (planned_rounds >= 1),
  current_round_number INTEGER NOT NULL DEFAULT 0,
  elimination_stages_json TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournament_configurations (
  tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  target_score INTEGER NOT NULL DEFAULT 100 CHECK (target_score BETWEEN 50 AND 300),
  round_duration_seconds INTEGER NOT NULL DEFAULT 1500 CHECK (round_duration_seconds BETWEEN 300 AND 7200),
  warning_before_end_seconds INTEGER NOT NULL DEFAULT 300 CHECK (warning_before_end_seconds >= 0),
  max_physical_tables INTEGER CHECK (max_physical_tables IS NULL OR max_physical_tables >= 1),
  tie_resolution_rule TEXT NOT NULL DEFAULT 'allow_draw_on_time' CHECK (tie_resolution_rule IN ('allow_draw_on_time')),
  final_tie_breaker TEXT NOT NULL DEFAULT 'playoff_match' CHECK (final_tie_breaker IN ('playoff_match', 'shared_title')),
  ranking_mode TEXT NOT NULL CHECK (ranking_mode IN ('equal_games', 'unequal_games')),
  allow_competitive_pairing INTEGER NOT NULL DEFAULT 1 CHECK (allow_competitive_pairing IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tournament_rule_snapshots (
  tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL,
  structured_rules_json TEXT NOT NULL,
  rendered_text_md TEXT NOT NULL,
  explanation_summary TEXT NOT NULL,
  accepted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  participant_number INTEGER NOT NULL CHECK (participant_number >= 1),
  display_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'eliminated')),
  withdrawn_after_round INTEGER,
  eliminated_after_round INTEGER,
  is_substitute INTEGER NOT NULL DEFAULT 0 CHECK (is_substitute IN (0, 1)),
  substituted_for_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (tournament_id, participant_number)
);

CREATE TABLE IF NOT EXISTS planned_round_byes (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  participant_id TEXT NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, round_number, participant_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  phase TEXT NOT NULL DEFAULT 'regular' CHECK (phase IN ('regular', 'qualifying', 'elimination', 'final')),
  stage_name TEXT NOT NULL DEFAULT 'Ronda',
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'paused', 'time_expired', 'recording_results', 'completed')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60),
  elapsed_before_run_ms INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_before_run_ms >= 0),
  timer_started_at_utc_ms INTEGER,
  warning_fired_at_utc_ms INTEGER,
  expired_fired_at_utc_ms INTEGER,
  metrics_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  UNIQUE (tournament_id, round_number)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL CHECK (table_number >= 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  pair_a_score INTEGER CHECK (pair_a_score IS NULL OR pair_a_score >= 0),
  pair_b_score INTEGER CHECK (pair_b_score IS NULL OR pair_b_score >= 0),
  winner_pair TEXT CHECK (winner_pair IS NULL OR winner_pair IN ('A', 'B')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('pair_a_win', 'pair_b_win', 'draw')),
  ended_by TEXT CHECK (ended_by IS NULL OR ended_by IN ('target_score', 'time_expired', 'admin_override')),
  recorded_at TEXT,
  updated_at TEXT,
  UNIQUE (round_id, table_number),
  CHECK (
    (status = 'pending' AND pair_a_score IS NULL AND pair_b_score IS NULL AND winner_pair IS NULL AND outcome IS NULL)
    OR
    (status = 'completed' AND pair_a_score IS NOT NULL AND pair_b_score IS NOT NULL AND outcome IS NOT NULL AND (
      (pair_a_score > pair_b_score AND winner_pair = 'A' AND outcome = 'pair_a_win') OR
      (pair_b_score > pair_a_score AND winner_pair = 'B' AND outcome = 'pair_b_win') OR
      (pair_a_score = pair_b_score AND winner_pair IS NULL AND outcome = 'draw' AND ended_by IN ('time_expired', 'admin_override'))
    ))
  )
);

CREATE TABLE IF NOT EXISTS match_participants (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES tournament_participants(id) ON DELETE RESTRICT,
  pair_side TEXT NOT NULL CHECK (pair_side IN ('A', 'B')),
  seat_slot INTEGER NOT NULL CHECK (seat_slot IN (1, 2)),
  PRIMARY KEY (match_id, participant_id),
  UNIQUE (match_id, pair_side, seat_slot)
);

CREATE TABLE IF NOT EXISTS round_byes (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES tournament_participants(id) ON DELETE RESTRICT,
  PRIMARY KEY (round_id, participant_id)
);

CREATE TABLE IF NOT EXISTS result_audit_logs (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('recorded', 'corrected')),
  prev_pair_a_score INTEGER,
  prev_pair_b_score INTEGER,
  new_pair_a_score INTEGER NOT NULL,
  new_pair_b_score INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_tournament ON tournament_participants(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON rounds(tournament_id, round_number);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round_id, table_number);
CREATE INDEX IF NOT EXISTS idx_match_participants_participant ON match_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tournament ON result_audit_logs(tournament_id, created_at);
