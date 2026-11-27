use crate::db::{Database, TournamentEnvelope};
use crate::power;
use tauri::State;

#[tauri::command]
pub fn save_tournament(
    db: State<'_, Database>,
    envelope: TournamentEnvelope,
) -> Result<(), String> {
    db.save_tournament(&envelope).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tournament(db: State<'_, Database>, id: String) -> Result<Option<String>, String> {
    db.get_tournament_payload(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tournaments(db: State<'_, Database>) -> Result<Vec<String>, String> {
    db.list_tournament_payloads().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_draft_tournament(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_draft(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tournament(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_tournament(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_keep_awake(enabled: bool) {
    power::set_keep_awake(enabled);
}

#[tauri::command]
pub fn backup_database(
    db: State<'_, Database>,
    destination_path: String,
) -> Result<(), String> {
    db.backup_to(&destination_path).map_err(|e| e.to_string())
}
