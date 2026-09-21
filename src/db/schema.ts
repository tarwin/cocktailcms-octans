// ---------------------------------------------------------------------------
// Database schema. Blueprints (the old "schemas") and their fields are proper
// tables; record VALUES stay as one JSON document per record because the
// columns are user-defined and change at runtime. SQLite's JSON functions
// (json_extract, json_each) make that queryable, and `views.ts` exposes each
// blueprint as a real SQL view for the export page.
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id    INTEGER PRIMARY KEY,
  key   TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  ord   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blueprints (
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id             INTEGER NOT NULL,
  key            TEXT NOT NULL,
  label          TEXT NOT NULL,
  ord            INTEGER NOT NULL DEFAULT 0,
  hidden         INTEGER NOT NULL DEFAULT 0,
  secondary      INTEGER NOT NULL DEFAULT 0,
  next_record_id INTEGER NOT NULL DEFAULT 1,
  config         TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS fields (
  project_id   INTEGER NOT NULL,
  blueprint_id INTEGER NOT NULL,
  id           INTEGER NOT NULL,
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  type         TEXT NOT NULL,
  ord          REAL NOT NULL DEFAULT 0,
  required     INTEGER NOT NULL DEFAULT 0,
  hide_in_list INTEGER NOT NULL DEFAULT 0,
  help         TEXT NOT NULL DEFAULT '',
  params       TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, blueprint_id, id),
  FOREIGN KEY (project_id, blueprint_id) REFERENCES blueprints(project_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS records (
  project_id   INTEGER NOT NULL,
  blueprint_id INTEGER NOT NULL,
  id           INTEGER NOT NULL,
  data         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (project_id, blueprint_id, id),
  FOREIGN KEY (project_id, blueprint_id) REFERENCES blueprints(project_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id         INTEGER NOT NULL,
  name       TEXT NOT NULL,
  mime_type  TEXT NOT NULL DEFAULT '',
  size       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  data       BLOB,
  thumb      BLOB,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS settings (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  data       TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO projects (id, key, label, ord) VALUES (1, 'default', 'Default', 1);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
`
