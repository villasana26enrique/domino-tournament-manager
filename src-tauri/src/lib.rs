pub mod commands;
pub mod db;
pub mod power;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_local_data_dir()
                .expect("No se pudo resolver el directorio local de datos de la aplicación");
            let db_path = data_dir.join("data.db");
            let database =
                Database::open(&db_path).expect("No se pudo inicializar la base de datos SQLite");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_tournament,
            commands::get_tournament,
            commands::list_tournaments,
            commands::delete_draft_tournament,
            commands::delete_tournament,
            commands::set_keep_awake,
            commands::backup_database
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar Domino Tournament Manager");
}
