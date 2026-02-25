-- Consolidation of all application tables with standardized metadata
-- Metadata: created_at, created_by, updated_at, updated_by

-- 1. App Settings (for seeding flags etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'system',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'system'
);

-- 2. User Profile
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  age INTEGER,
  resting_hr INTEGER,
  max_hr INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'user',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'user'
);

-- 3. Training Sessions (Actual recorded runs)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at DATETIME,
  duration_secs INTEGER,
  distance_m REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_pace_sec_per_km REAL,
  zone2_pct REAL,
  raw_fit_path TEXT,
  ai_analysis TEXT,
  avg_cadence INTEGER,
  efficiency_factor REAL,
  aerobic_decoupling_pct REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'import',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'import'
);

-- 4. Records (Detailed stream data from fit files)
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp DATETIME,
  heart_rate INTEGER,
  speed_ms REAL,
  distance_m REAL,
  cadence INTEGER,
  altitude_m REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'import',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'import'
);

-- 5. Body Metrics (OCR from images)
CREATE TABLE IF NOT EXISTS body_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at DATE,
  weight_kg REAL,
  body_fat_pct REAL,
  bmi REAL,
  fat_free_body_weight_kg REAL,
  subcutaneous_fat_pct REAL,
  visceral_fat INTEGER,
  body_water_pct REAL,
  skeletal_muscle_pct REAL,
  muscle_mass_kg REAL,
  bone_mass_kg REAL,
  protein_pct REAL,
  bmr_kcal INTEGER,
  metabolic_age INTEGER,
  heart_rate INTEGER,
  image_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'user',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'user'
);

-- 6. Granular Training Plan - Weeks
CREATE TABLE IF NOT EXISTS training_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_number INTEGER NOT NULL,
  month_index INTEGER NOT NULL,
  target_km REAL,
  phase TEXT,
  focus_point TEXT,
  actual_km REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'seeder',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'seeder'
);

-- 7. Granular Training Plan - Daily Sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES training_weeks(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 1=Mon, 7=Sun
  title TEXT,
  planned_distance_m REAL,
  planned_duration_min INTEGER,
  intensity_target TEXT,
  description TEXT,
  actual_session_id TEXT REFERENCES sessions(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'seeder',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'seeder'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_records_session_time ON records(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_training_sessions_week ON training_sessions(week_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(started_at);
