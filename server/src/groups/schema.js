// Additive migration. Rollback deployment retains these tables and all historical rows.
function migrate(db) {
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS group_schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS study_groups(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, study_topic TEXT NOT NULL,
      baseline_type TEXT NOT NULL CHECK(baseline_type IN ('duration','quantity')),
      baseline_value INTEGER NOT NULL CHECK(baseline_value > 0), baseline_unit TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL, archived_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS group_memberships(
      id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES study_groups(id), user_id TEXT NOT NULL REFERENCES users(id),
      nickname TEXT NOT NULL, avatar INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('formal','observer','ended')),
      joined_at INTEGER NOT NULL, joined_date TEXT NOT NULL, evaluation_start_date TEXT NOT NULL,
      exited_at INTEGER, end_reason TEXT, end_status TEXT,
      streak INTEGER NOT NULL DEFAULT 0, longest_streak INTEGER NOT NULL DEFAULT 0,
      week_key TEXT NOT NULL, weekly_miss INTEGER NOT NULL DEFAULT 0,
      leave_week TEXT NOT NULL, weekly_leave INTEGER NOT NULL DEFAULT 0,
      observer_progress INTEGER NOT NULL DEFAULT 0, recovered_on TEXT,
      last_settled_date TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS group_one_current_per_user ON group_memberships(user_id) WHERE status IN ('formal','observer');
    CREATE INDEX IF NOT EXISTS group_members_by_group ON group_memberships(group_id, status);
    CREATE INDEX IF NOT EXISTS group_members_history ON group_memberships(user_id, group_id, joined_at);
    CREATE TABLE IF NOT EXISTS group_daily_records(
      membership_id TEXT NOT NULL REFERENCES group_memberships(id), business_date TEXT NOT NULL,
      total_value INTEGER NOT NULL DEFAULT 0 CHECK(total_value >= 0), revision INTEGER NOT NULL DEFAULT 0,
      seat TEXT NOT NULL, is_day_off INTEGER NOT NULL DEFAULT 0, daily_state TEXT NOT NULL DEFAULT 'pending',
      card_result TEXT NOT NULL DEFAULT '', settled INTEGER NOT NULL DEFAULT 0, settled_at INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY(membership_id, business_date)
    );
    CREATE INDEX IF NOT EXISTS group_records_date ON group_daily_records(business_date, membership_id);
    CREATE TABLE IF NOT EXISTS group_events(
      id INTEGER PRIMARY KEY, group_id TEXT NOT NULL REFERENCES study_groups(id),
      membership_id TEXT NOT NULL REFERENCES group_memberships(id), business_date TEXT NOT NULL,
      kind TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(membership_id, business_date, kind)
    );
    CREATE TABLE IF NOT EXISTS group_requests(
      user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, request_id)
    );
    INSERT OR IGNORE INTO group_schema_migrations VALUES(1, CAST(strftime('%s','now') AS INTEGER)*1000);
    COMMIT;`);
}
module.exports = { migrate };
