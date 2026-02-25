use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct UserProfile {
    pub id: i32,
    pub age: Option<i32>,
    pub resting_hr: Option<i32>,
    pub max_hr: Option<i32>,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub started_at: String,
    pub duration_secs: i32,
    pub distance_m: f64,
    pub avg_hr: i32,
    pub max_hr: i32,
    pub avg_pace_sec_per_km: f64,
    pub zone2_pct: f64,
    pub raw_fit_path: String,
    pub ai_analysis: Option<String>,
    pub avg_cadence: Option<i32>,
    pub efficiency_factor: Option<f64>,
    pub aerobic_decoupling_pct: Option<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct Record {
    pub timestamp: String,
    pub heart_rate: Option<i32>,
    pub speed_ms: Option<f64>,
    pub distance_m: Option<f64>,
    pub cadence: Option<i32>,
    pub altitude_m: Option<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct BodyMetrics {
    #[serde(default)]
    pub id: i32,
    pub weight_kg: f64,
    pub body_fat_pct: Option<f64>,
    pub bmi: Option<f64>,
    pub fat_free_body_weight_kg: Option<f64>,
    pub subcutaneous_fat_pct: Option<f64>,
    pub visceral_fat: Option<i32>,
    pub body_water_pct: Option<f64>,
    pub skeletal_muscle_pct: Option<f64>,
    pub muscle_mass_kg: Option<f64>,
    pub bone_mass_kg: Option<f64>,
    pub protein_pct: Option<f64>,
    pub bmr_kcal: Option<i32>,
    pub metabolic_age: Option<i32>,
    pub heart_rate: Option<i32>,
    pub recorded_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct WeeklyPlan {
    pub id: i32,
    pub week_number: i32,
    pub month_index: i32,
    pub target_km: f64,
    pub phase: String,
    pub focus_point: String,
    pub actual_km: f64,
}

#[derive(Serialize, Deserialize)]
pub struct TrainingSession {
    pub id: Option<i32>,
    pub week_id: i32,
    pub day_of_week: i32,
    pub title: String,
    pub planned_duration_min: i32,
    pub intensity_target: String,
    pub description: String,
}

#[derive(Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct MonthlySummary {
    pub month: String,
    pub total_distance_km: f64,
    pub total_duration_min: f64,
    pub session_count: i32,
}

pub struct DbManager {
    pub path: PathBuf,
}

impl DbManager {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn get_connection(&self) -> Result<Connection> {
        let conn = Connection::open(&self.path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        conn.execute_batch("PRAGMA busy_timeout = 30000;")?;
        conn.execute_batch("PRAGMA synchronous = NORMAL;")?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        // Ensure schema exists — safe to run multiple times due to IF NOT EXISTS
        conn.execute_batch(include_str!("db/01_init.sql"))?;
        
        // Ensure new columns exist for existing databases without dropping data
        let _ = conn.execute("ALTER TABLE sessions ADD COLUMN avg_cadence INTEGER", []);
        let _ = conn.execute("ALTER TABLE sessions ADD COLUMN efficiency_factor REAL", []);
        let _ = conn.execute("ALTER TABLE sessions ADD COLUMN aerobic_decoupling_pct REAL", []);
        
        // Ensure at least one user profile row exists
        conn.execute_batch("INSERT OR IGNORE INTO users (id, age, resting_hr, max_hr) VALUES (1, 27, 62, 193);")?;
        Ok(conn)
    }
}

// User Commands
pub fn get_user_profile(conn: &Connection) -> Result<Option<UserProfile>> {
    let mut stmt = conn.prepare("SELECT id, age, resting_hr, max_hr, updated_at FROM users ORDER BY id DESC LIMIT 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        Ok(Some(UserProfile {
            id: row.get(0)?, age: row.get(1)?, resting_hr: row.get(2)?, max_hr: row.get(3)?, updated_at: row.get(4)?,
        }))
    } else { Ok(None) }
}

pub fn update_user_profile(conn: &Connection, profile: UserProfile) -> Result<()> {
    conn.execute(
        "UPDATE users SET age = ?1, resting_hr = ?2, max_hr = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4",
        params![profile.age, profile.resting_hr, profile.max_hr, profile.id],
    )?;
    Ok(())
}

// Session Commands
pub fn get_all_sessions(conn: &Connection) -> Result<Vec<Session>> {
    let mut stmt = conn.prepare("SELECT id, started_at, duration_secs, distance_m, avg_hr, max_hr, avg_pace_sec_per_km, zone2_pct, raw_fit_path, ai_analysis, avg_cadence, efficiency_factor, aerobic_decoupling_pct FROM sessions ORDER BY started_at DESC")?;
    let sessions = stmt.query_map([], |row| {
        Ok(Session {
            id: row.get(0)?, started_at: row.get(1)?, duration_secs: row.get(2)?, distance_m: row.get(3)?,
            avg_hr: row.get(4)?, max_hr: row.get(5)?, avg_pace_sec_per_km: row.get(6)?, zone2_pct: row.get(7)?, raw_fit_path: row.get(8)?, ai_analysis: row.get(9)?,
            avg_cadence: row.get(10)?, efficiency_factor: row.get(11)?, aerobic_decoupling_pct: row.get(12)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(sessions)
}

pub fn get_recent_sessions(conn: &Connection, limit: i32) -> Result<Vec<Session>> {
    let mut stmt = conn.prepare("SELECT id, started_at, duration_secs, distance_m, avg_hr, max_hr, avg_pace_sec_per_km, zone2_pct, raw_fit_path, ai_analysis, avg_cadence, efficiency_factor, aerobic_decoupling_pct FROM sessions ORDER BY started_at DESC LIMIT ?1")?;
    let sessions = stmt.query_map(params![limit], |row| {
        Ok(Session {
            id: row.get(0)?, started_at: row.get(1)?, duration_secs: row.get(2)?, distance_m: row.get(3)?,
            avg_hr: row.get(4)?, max_hr: row.get(5)?, avg_pace_sec_per_km: row.get(6)?, zone2_pct: row.get(7)?, raw_fit_path: row.get(8)?, ai_analysis: row.get(9)?,
            avg_cadence: row.get(10)?, efficiency_factor: row.get(11)?, aerobic_decoupling_pct: row.get(12)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(sessions)
}

pub fn get_session_by_id(conn: &Connection, id: &str) -> Result<Option<Session>> {
    let mut stmt = conn.prepare("SELECT id, started_at, duration_secs, distance_m, avg_hr, max_hr, avg_pace_sec_per_km, zone2_pct, raw_fit_path, ai_analysis, avg_cadence, efficiency_factor, aerobic_decoupling_pct FROM sessions WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Session {
            id: row.get(0)?, started_at: row.get(1)?, duration_secs: row.get(2)?, distance_m: row.get(3)?,
            avg_hr: row.get(4)?, max_hr: row.get(5)?, avg_pace_sec_per_km: row.get(6)?, zone2_pct: row.get(7)?, raw_fit_path: row.get(8)?, ai_analysis: row.get(9)?,
            avg_cadence: row.get(10)?, efficiency_factor: row.get(11)?, aerobic_decoupling_pct: row.get(12)?,
        }))
    } else { Ok(None) }
}

pub fn get_records_by_session(conn: &Connection, session_id: &str) -> Result<Vec<Record>> {
    let mut stmt = conn.prepare("SELECT timestamp, heart_rate, speed_ms, distance_m, cadence, altitude_m FROM records WHERE session_id = ?1 ORDER BY timestamp ASC")?;
    let records = stmt.query_map(params![session_id], |row| {
        Ok(Record {
            timestamp: row.get(0)?, heart_rate: row.get(1)?, speed_ms: row.get(2)?, distance_m: row.get(3)?, cadence: row.get(4)?, altitude_m: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(records)
}

pub fn get_monthly_summary(conn: &Connection) -> Result<Vec<MonthlySummary>> {
    let mut stmt = conn.prepare("
        SELECT 
            strftime('%Y-%m', started_at) as month,
            SUM(distance_m) / 1000.0 as dist_km,
            SUM(duration_secs) / 60.0 as dur_min,
            COUNT(*) as count
        FROM sessions 
        GROUP BY month 
        ORDER BY month DESC 
        LIMIT 6
    ")?;
    let summary = stmt.query_map([], |row| {
        Ok(MonthlySummary {
            month: row.get(0)?,
            total_distance_km: row.get(1)?,
            total_duration_min: row.get(2)?,
            session_count: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(summary)
}

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_body_metrics(conn: &Connection, id: i32) -> Result<()> {
    conn.execute("DELETE FROM body_metrics WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn add_body_metrics(conn: &Connection, data: &BodyMetrics) -> Result<()> {
    conn.execute(
        "INSERT INTO body_metrics (recorded_at, weight_kg, body_fat_pct, bmi, fat_free_body_weight_kg,
         subcutaneous_fat_pct, visceral_fat, body_water_pct, skeletal_muscle_pct, muscle_mass_kg,
         bone_mass_kg, protein_pct, bmr_kcal, metabolic_age, heart_rate, created_by, updated_by)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,'user','user')",
        params![
            data.recorded_at, data.weight_kg, data.body_fat_pct, data.bmi,
            data.fat_free_body_weight_kg, data.subcutaneous_fat_pct, data.visceral_fat,
            data.body_water_pct, data.skeletal_muscle_pct, data.muscle_mass_kg,
            data.bone_mass_kg, data.protein_pct, data.bmr_kcal, data.metabolic_age, data.heart_rate
        ],
    )?;
    Ok(())
}

// Training Plan Commands
pub fn get_yearly_plan(conn: &Connection) -> Result<Vec<WeeklyPlan>> {
    let mut stmt = conn.prepare("SELECT id, week_number, month_index, target_km, phase, focus_point, actual_km FROM training_weeks ORDER BY week_number ASC")?;
    let plan = stmt.query_map([], |row| {
        Ok(WeeklyPlan {
            id: row.get(0)?, week_number: row.get(1)?, month_index: row.get(2)?,
            target_km: row.get(3)?, phase: row.get(4)?, focus_point: row.get(5)?, actual_km: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(plan)
}

pub fn bulk_create_plan(conn: &Connection, plans: Vec<WeeklyPlan>) -> Result<Vec<i64>> {
    let mut ids = Vec::new();
    for p in plans {
        conn.execute(
            "INSERT INTO training_weeks (week_number, month_index, target_km, phase, focus_point, actual_km, created_by, updated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'seeder', 'seeder')",
            params![p.week_number, p.month_index, p.target_km, p.phase, p.focus_point, p.actual_km],
        )?;
        ids.push(conn.last_insert_rowid());
    }
    Ok(ids)
}

pub fn bulk_create_sessions(conn: &Connection, sessions: Vec<TrainingSession>) -> Result<()> {
     for s in sessions {
        conn.execute(
            "INSERT INTO training_sessions (week_id, day_of_week, title, planned_duration_min, intensity_target, description, created_by, updated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'seeder', 'seeder')",
            params![s.week_id, s.day_of_week, s.title, s.planned_duration_min, s.intensity_target, s.description],
        )?;
    }
    Ok(())
}

pub fn get_all_training_sessions(conn: &Connection) -> Result<Vec<TrainingSession>> {
    let mut stmt = conn.prepare("SELECT id, week_id, day_of_week, title, planned_duration_min, intensity_target, description FROM training_sessions")?;
    let sessions = stmt.query_map([], |row| {
        Ok(TrainingSession {
            id: row.get(0)?,
            week_id: row.get(1)?,
            day_of_week: row.get(2)?,
            title: row.get(3)?,
            planned_duration_min: row.get(4)?,
            intensity_target: row.get(5)?,
            description: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(sessions)
}

// Body Metrics Commands
pub fn get_all_body_metrics(conn: &Connection) -> Result<Vec<BodyMetrics>> {
    let mut stmt = conn.prepare("SELECT id, weight_kg, body_fat_pct, bmi, fat_free_body_weight_kg, subcutaneous_fat_pct, visceral_fat, body_water_pct, skeletal_muscle_pct, muscle_mass_kg, bone_mass_kg, protein_pct, bmr_kcal, metabolic_age, heart_rate, recorded_at FROM body_metrics ORDER BY recorded_at DESC")?;
    let metrics = stmt.query_map([], |row| {
        Ok(BodyMetrics {
            id: row.get(0)?, weight_kg: row.get(1)?, body_fat_pct: row.get(2)?, bmi: row.get(3)?,
            fat_free_body_weight_kg: row.get(4)?, subcutaneous_fat_pct: row.get(5)?, visceral_fat: row.get(6)?,
            body_water_pct: row.get(7)?, skeletal_muscle_pct: row.get(8)?, muscle_mass_kg: row.get(9)?,
            bone_mass_kg: row.get(10)?, protein_pct: row.get(11)?, bmr_kcal: row.get(12)?,
            metabolic_age: row.get(13)?, heart_rate: row.get(14)?, recorded_at: row.get(15)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(metrics)
}

pub fn is_session_duplicate(conn: &Connection, started_at: &str) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT 1 FROM sessions WHERE started_at = ?1 LIMIT 1")?;
    Ok(stmt.exists(params![started_at])?)
}

pub fn create_session(conn: &Connection, s: Session) -> Result<()> {
    conn.execute(
        "INSERT INTO sessions (id, started_at, duration_secs, distance_m, avg_hr, max_hr, avg_pace_sec_per_km, zone2_pct, raw_fit_path, ai_analysis, avg_cadence, efficiency_factor, aerobic_decoupling_pct, created_by, updated_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'import', 'import')",
        params![s.id, s.started_at, s.duration_secs, s.distance_m, s.avg_hr, s.max_hr, s.avg_pace_sec_per_km, s.zone2_pct, s.raw_fit_path, s.ai_analysis, s.avg_cadence, s.efficiency_factor, s.aerobic_decoupling_pct],
    )?;
    Ok(())
}

pub fn update_session_analysis(conn: &Connection, id: &str, ai_analysis: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET ai_analysis = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![ai_analysis, id],
    )?;
    Ok(())
}

pub fn create_records_chunk(conn: &Connection, session_id: &str, records: Vec<Record>) -> Result<()> {
    let mut sql = "INSERT INTO records (session_id, timestamp, heart_rate, speed_ms, distance_m, cadence, altitude_m, created_by, updated_by) VALUES ".to_string();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::with_capacity(records.len() * 9);
    
    for (i, r) in records.iter().enumerate() {
        if i > 0 { sql.push_str(", "); }
        let b = i * 9;
        sql.push_str(&format!("(?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{})", b+1, b+2, b+3, b+4, b+5, b+6, b+7, b+8, b+9));
        
        params_vec.push(session_id.to_string().into());
        params_vec.push(r.timestamp.clone().into());
        params_vec.push(r.heart_rate.map(|v| v as i64).into());
        params_vec.push(r.speed_ms.into());
        params_vec.push(r.distance_m.into());
        params_vec.push(r.cadence.map(|v| v as i64).into());
        params_vec.push(r.altitude_m.into());
        params_vec.push("import".to_string().into());
        params_vec.push("import".to_string().into());
    }

    let mut stmt = conn.prepare(&sql)?;
    stmt.execute(rusqlite::params_from_iter(params_vec))?;
    Ok(())
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, created_by, updated_by) VALUES (?1, ?2, 'system', 'system')",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else { Ok(None) }
}
