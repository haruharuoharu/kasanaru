PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS room(id INTEGER PRIMARY KEY CHECK(id=1),state TEXT NOT NULL DEFAULT 'draft',rules_json TEXT NOT NULL,rules_hash TEXT NOT NULL,rules_tx TEXT,recorder TEXT,closed_at TEXT,snapshot_json TEXT,snapshot_hash TEXT,result_tx TEXT);
CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY,group_name TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS votes(participant_id TEXT NOT NULL REFERENCES participants(id),question_id TEXT NOT NULL,answer TEXT CHECK(answer IN ('agree','disagree','pass')),PRIMARY KEY(participant_id,question_id));
