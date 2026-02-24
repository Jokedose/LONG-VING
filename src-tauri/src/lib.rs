mod db;

use db::{DbManager, UserProfile, Session, Record, BodyMetrics, TrainingSession};
use tauri::{Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};
use base64::{Engine as _, engine::general_purpose};
use objc2::{msg_send, AnyThread};
use objc2_foundation::{NSData, NSArray, NSDictionary, NSString, NSError};
use objc2_vision::{VNImageRequestHandler, VNRecognizeTextRequest, VNRequest};

#[tauri::command]
fn get_user_profile(state: State<'_, DbManager>) -> Result<Option<UserProfile>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_user_profile(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_user_profile(state: State<'_, DbManager>, profile: UserProfile) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::update_user_profile(&conn, profile).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_sessions(state: State<'_, DbManager>) -> Result<Vec<Session>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_all_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recent_sessions(state: State<'_, DbManager>, limit: i32) -> Result<Vec<Session>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_recent_sessions(&conn, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monthly_summary(state: State<'_, DbManager>) -> Result<Vec<db::MonthlySummary>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_monthly_summary(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_session_by_id(state: State<'_, DbManager>, id: String) -> Result<Option<Session>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_session_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_records_by_session(state: State<'_, DbManager>, session_id: String) -> Result<Vec<Record>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_records_by_session(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_session(state: State<'_, DbManager>, id: String) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::delete_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_session_duplicate(state: State<'_, DbManager>, started_at: String) -> Result<bool, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::is_session_duplicate(&conn, &started_at).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_session(state: State<'_, DbManager>, session: Session) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::create_session(&conn, session).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_records_chunk(state: State<'_, DbManager>, session_id: String, records: Vec<Record>) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::create_records_chunk(&conn, &session_id, records).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_body_metrics(state: State<'_, DbManager>) -> Result<Vec<BodyMetrics>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_all_body_metrics(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_body_metrics(state: State<'_, DbManager>, id: i32) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::delete_body_metrics(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_body_metrics(state: State<'_, DbManager>, data: BodyMetrics) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::add_body_metrics(&conn, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_yearly_plan(state: State<'_, DbManager>) -> Result<Vec<db::WeeklyPlan>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_yearly_plan(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn bulk_create_plan(state: State<'_, DbManager>, plans: Vec<db::WeeklyPlan>) -> Result<Vec<i64>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::bulk_create_plan(&conn, plans).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_training_sessions(state: State<'_, DbManager>) -> Result<Vec<TrainingSession>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_all_training_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn bulk_create_sessions(state: State<'_, DbManager>, sessions: Vec<TrainingSession>) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::bulk_create_sessions(&conn, sessions).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: State<'_, DbManager>, key: String) -> Result<Option<String>, String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<'_, DbManager>, key: String, value: String) -> Result<(), String> {
    let conn = state.get_connection().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn recognize_text(image_base64: String) -> Result<String, String> {
    let clean_base64 = image_base64
        .trim_start_matches("data:image/png;base64,")
        .trim_start_matches("data:image/jpeg;base64,")
        .trim_start_matches("data:image/webp;base64,");
    
    let bytes = general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    
    let data = NSData::from_vec(bytes);
    
    unsafe {
        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(objc2_vision::VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(true);
        
        let languages = NSArray::from_retained_slice(&[
            NSString::from_str("th-TH"),
            NSString::from_str("en-US"),
        ]);
        let _: () = msg_send![&request, setRecognitionLanguages: &*languages];

        let handler = VNImageRequestHandler::initWithData_options(
            VNImageRequestHandler::alloc(),
            &data,
            &NSDictionary::new(),
        );

        let requests = NSArray::from_retained_slice(&[
            objc2::rc::Retained::cast_unchecked::<VNRequest>(request.clone())
        ]);
        
        let mut error: *mut NSError = std::ptr::null_mut();
        let success: bool = msg_send![&handler, performRequests: &*requests, error: &mut error];

        if !success || !error.is_null() {
            let err_msg = if !error.is_null() {
                (*error).localizedDescription().to_string()
            } else {
                "Unknown Vision error".to_string()
            };
            return Err(format!("Vision performance error: {}", err_msg));
        }

        let results_ptr: *mut NSArray<objc2::runtime::AnyObject> = msg_send![&request, results];
        if results_ptr.is_null() {
            return Ok("".to_string());
        }
        let results = &*results_ptr;
        let mut text_output = Vec::new();

        for i in 0..results.count() {
            let observation_ptr: *mut objc2::runtime::AnyObject = msg_send![results, objectAtIndex: i];
            if observation_ptr.is_null() { continue; }
            
            let candidates_ptr: *mut NSArray<objc2::runtime::AnyObject> = msg_send![observation_ptr, topCandidates: 1usize];
            if candidates_ptr.is_null() { continue; }
            
            let candidates = &*candidates_ptr;
            if candidates.count() > 0 {
                let recognized_text_ptr: *mut objc2::runtime::AnyObject = msg_send![candidates, objectAtIndex: 0usize];
                if recognized_text_ptr.is_null() { continue; }

                let text_ptr: *mut NSString = msg_send![recognized_text_ptr, string];
                if !text_ptr.is_null() {
                    let text = &*text_ptr;
                    text_output.push(text.to_string());
                }
            }
        }

        Ok(text_output.join("\n"))
    }
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "consolidated_init",
            sql: include_str!("db/01_init.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("longving.db");
            app.manage(DbManager::new(path));
            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:longving.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_log::Builder::new().target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout)).build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            recognize_text,
            get_user_profile,
            update_user_profile,
            get_all_sessions,
            get_recent_sessions,
            get_monthly_summary,
            get_session_by_id,
            get_records_by_session,
            delete_session,
            is_session_duplicate,
            create_session,
            create_records_chunk,
            get_all_body_metrics,
            delete_body_metrics,
            add_body_metrics,
            get_yearly_plan,
            get_all_training_sessions,
            bulk_create_plan,
            bulk_create_sessions,
            get_setting,
            set_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
