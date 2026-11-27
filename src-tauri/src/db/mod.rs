use rusqlite::{backup::Backup, params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use thiserror::Error;

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Error de SQLite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Error de serialización JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Error de E/S en almacenamiento local: {0}")]
    Io(#[from] std::io::Error),
    #[error("Error de bloqueo interno en base de datos")]
    LockPoisoned,
    #[error("Operación inválida: {0}")]
    InvalidOperation(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentEnvelope {
    pub id: String,
    pub name: String,
    pub status: String,
    pub seed: String,
    pub planned_rounds: i64,
    pub current_round_number: i64,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
    pub config: TournamentConfigRow,
    pub rule_snapshot: Option<serde_json::Value>,
    pub elimination_stages: Option<serde_json::Value>,
    pub payload_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentConfigRow {
    pub format: String,
    pub scheduling_mode: String,
    pub target_score: i64,
    pub round_duration_seconds: i64,
    pub warning_before_end_seconds: i64,
    pub max_physical_tables: Option<i64>,
    pub tie_resolution_rule: String,
    pub final_tie_breaker: String,
    pub allow_competitive_pairing: bool,
}

pub struct Database {
    conn: Mutex<Connection>,
    db_path: PathBuf,
}

impl Database {
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self, DbError> {
        let path = db_path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            PRAGMA synchronous = FULL;
            PRAGMA busy_timeout = 5000;
            ",
        )?;

        let db = Self {
            conn: Mutex::new(conn),
            db_path: path,
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );",
        )?;

        let applied: Option<i64> = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = 1",
                [],
                |row| row.get(0),
            )
            .optional()?;

        if applied.is_none() {
            let tx = conn.transaction()?;
            tx.execute_batch(MIGRATION_001)?;
            tx.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))",
                [],
            )?;
            tx.commit()?;
        }

        Ok(())
    }

    /// Saves a tournament record atomically inside a single SQLite transaction.
    pub fn save_tournament(&self, envelope: &TournamentEnvelope) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.transaction()?;

        let stages_json = envelope
            .elimination_stages
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        tx.execute(
            "
            INSERT INTO tournaments (
                id, name, modality, format, scheduling_mode, status, seed,
                planned_rounds, current_round_number, elimination_stages_json,
                payload_json, created_at, started_at, completed_at, updated_at
            )
            VALUES (?1, ?2, 'individual_rotating_pairs', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                format = excluded.format,
                scheduling_mode = excluded.scheduling_mode,
                status = excluded.status,
                seed = excluded.seed,
                planned_rounds = excluded.planned_rounds,
                current_round_number = excluded.current_round_number,
                elimination_stages_json = excluded.elimination_stages_json,
                payload_json = excluded.payload_json,
                started_at = excluded.started_at,
                completed_at = excluded.completed_at,
                updated_at = excluded.updated_at
            ",
            params![
                envelope.id,
                envelope.name,
                envelope.config.format,
                envelope.config.scheduling_mode,
                envelope.status,
                envelope.seed,
                envelope.planned_rounds,
                envelope.current_round_number,
                stages_json,
                envelope.payload_json,
                envelope.created_at,
                envelope.started_at,
                envelope.completed_at,
                envelope.updated_at,
            ],
        )?;

        let ranking_mode = if envelope.config.format == "rounds_all_play" {
            "equal_games"
        } else {
            "unequal_games"
        };

        tx.execute(
            "
            INSERT INTO tournament_configurations (
                tournament_id, target_score, round_duration_seconds, warning_before_end_seconds,
                max_physical_tables, tie_resolution_rule, final_tie_breaker, ranking_mode,
                allow_competitive_pairing
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(tournament_id) DO UPDATE SET
                target_score = excluded.target_score,
                round_duration_seconds = excluded.round_duration_seconds,
                warning_before_end_seconds = excluded.warning_before_end_seconds,
                max_physical_tables = excluded.max_physical_tables,
                tie_resolution_rule = excluded.tie_resolution_rule,
                final_tie_breaker = excluded.final_tie_breaker,
                ranking_mode = excluded.ranking_mode,
                allow_competitive_pairing = excluded.allow_competitive_pairing
            ",
            params![
                envelope.id,
                envelope.config.target_score,
                envelope.config.round_duration_seconds,
                envelope.config.warning_before_end_seconds,
                envelope.config.max_physical_tables,
                envelope.config.tie_resolution_rule,
                envelope.config.final_tie_breaker,
                ranking_mode,
                if envelope.config.allow_competitive_pairing { 1 } else { 0 },
            ],
        )?;

        if let Some(snapshot) = &envelope.rule_snapshot {
            let exists: Option<String> = tx
                .query_row(
                    "SELECT tournament_id FROM tournament_rule_snapshots WHERE tournament_id = ?1",
                    params![envelope.id],
                    |row| row.get(0),
                )
                .optional()?;

            // Rule snapshots are immutable once accepted at tournament start
            if exists.is_none() {
                let version = snapshot
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("1.1.0");
                let summary = snapshot
                    .get("summary")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let rendered_md = snapshot
                    .get("renderedMarkdown")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let structured_json = serde_json::to_string(snapshot)?;
                let accepted_at = envelope
                    .started_at
                    .as_deref()
                    .unwrap_or(&envelope.updated_at);

                tx.execute(
                    "
                    INSERT INTO tournament_rule_snapshots (
                        tournament_id, rules_version, structured_rules_json,
                        rendered_text_md, explanation_summary, accepted_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                    ",
                    params![
                        envelope.id,
                        version,
                        structured_json,
                        rendered_md,
                        summary,
                        accepted_at
                    ],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_tournament_payload(&self, id: &str) -> Result<Option<String>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let payload = conn
            .query_row(
                "SELECT payload_json FROM tournaments WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(payload)
    }

    pub fn list_tournament_payloads(&self) -> Result<Vec<String>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let mut stmt =
            conn.prepare("SELECT payload_json FROM tournaments ORDER BY updated_at DESC")?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn delete_draft(&self, id: &str) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.transaction()?;

        let status: Option<String> = tx
            .query_row(
                "SELECT status FROM tournaments WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;

        match status.as_deref() {
            None => return Ok(()),
            Some("draft") | Some("ready") => {
                tx.execute("DELETE FROM tournaments WHERE id = ?1", params![id])?;
                tx.commit()?;
                Ok(())
            }
            Some(other) => Err(DbError::InvalidOperation(format!(
                "Solo se pueden eliminar torneos en borrador (estado actual: {other})"
            ))),
        }
    }

    /// Deletes any tournament regardless of status (when explicitly confirmed by organizer).
    pub fn delete_tournament(&self, id: &str) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM tournaments WHERE id = ?1", params![id])?;
        tx.commit()?;
        Ok(())
    }

    /// Creates a consistent hot backup using the SQLite Online Backup API.
    pub fn backup_to(&self, destination: impl AsRef<Path>) -> Result<(), DbError> {
        let dest_path = destination.as_ref();
        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let src_conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let mut dst_conn = Connection::open(dest_path)?;
        let backup = Backup::new(&src_conn, &mut dst_conn)?;
        backup.run_to_completion(100, Duration::from_millis(10), None)?;
        Ok(())
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_envelope(id: &str, status: &str) -> TournamentEnvelope {
        TournamentEnvelope {
            id: id.to_string(),
            name: "Copa Vecinos".to_string(),
            status: status.to_string(),
            seed: "seed-42".to_string(),
            planned_rounds: 5,
            current_round_number: 0,
            created_at: "2026-11-27T12:00:00Z".to_string(),
            started_at: None,
            completed_at: None,
            updated_at: "2026-11-27T12:00:00Z".to_string(),
            config: TournamentConfigRow {
                format: "rounds_all_play".to_string(),
                scheduling_mode: "hybrid_competitive".to_string(),
                target_score: 100,
                round_duration_seconds: 1500,
                warning_before_end_seconds: 300,
                max_physical_tables: None,
                tie_resolution_rule: "allow_draw_on_time".to_string(),
                final_tie_breaker: "playoff_match".to_string(),
                allow_competitive_pairing: true,
            },
            rule_snapshot: None,
            elimination_stages: None,
            payload_json: format!("{{\"id\":\"{id}\",\"name\":\"Copa Vecinos\"}}"),
        }
    }

    #[test]
    fn opens_with_wal_and_runs_idempotent_migrations() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("data.db");

        let db = Database::open(&path).unwrap();
        drop(db);
        // Re-opening must be idempotent
        let db2 = Database::open(&path).unwrap();

        let conn = db2.conn.lock().unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode.to_lowercase(), "wal");
    }

    #[test]
    fn saves_lists_and_protects_started_tournaments_from_deletion() {
        let dir = tempdir().unwrap();
        let db = Database::open(dir.path().join("data.db")).unwrap();

        let draft = sample_envelope("trn-1", "draft");
        db.save_tournament(&draft).unwrap();
        assert_eq!(db.list_tournament_payloads().unwrap().len(), 1);
        assert!(db.get_tournament_payload("trn-1").unwrap().is_some());

        let started = sample_envelope("trn-2", "in_progress");
        db.save_tournament(&started).unwrap();

        assert!(db.delete_draft("trn-2").is_err());
        db.delete_draft("trn-1").unwrap();
        assert!(db.get_tournament_payload("trn-1").unwrap().is_none());

        db.delete_tournament("trn-2").unwrap();
        assert!(db.get_tournament_payload("trn-2").unwrap().is_none());
    }

    #[test]
    fn enforces_match_draw_on_time_check_constraint() {
        let dir = tempdir().unwrap();
        let db = Database::open(dir.path().join("data.db")).unwrap();
        let env = sample_envelope("trn-check", "in_progress");
        db.save_tournament(&env).unwrap();

        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO rounds (id, tournament_id, round_number, phase, stage_name, status, duration_seconds)
             VALUES ('r1', 'trn-check', 1, 'regular', 'Ronda 1', 'recording_results', 1500)",
            [],
        )
        .unwrap();

        // Draw on time_expired MUST succeed (ADR-002)
        conn.execute(
            "INSERT INTO matches (id, round_id, table_number, status, pair_a_score, pair_b_score, winner_pair, outcome, ended_by)
             VALUES ('m1', 'r1', 1, 'completed', 64, 64, NULL, 'draw', 'time_expired')",
            [],
        )
        .unwrap();

        // Draw on target_score MUST fail CHECK constraint
        let bad = conn.execute(
            "INSERT INTO matches (id, round_id, table_number, status, pair_a_score, pair_b_score, winner_pair, outcome, ended_by)
             VALUES ('m2', 'r1', 2, 'completed', 100, 100, NULL, 'draw', 'target_score')",
            [],
        );
        assert!(bad.is_err());
    }

    #[test]
    fn creates_consistent_hot_backup() {
        let dir = tempdir().unwrap();
        let db = Database::open(dir.path().join("data.db")).unwrap();
        db.save_tournament(&sample_envelope("trn-bk", "draft")).unwrap();

        let backup_path = dir.path().join("backups/data-backup.db");
        db.backup_to(&backup_path).unwrap();

        let restored = Database::open(&backup_path).unwrap();
        assert!(restored.get_tournament_payload("trn-bk").unwrap().is_some());
    }
}
