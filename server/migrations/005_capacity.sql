ALTER TABLE memberships ADD COLUMN capacity_hours INTEGER NOT NULL DEFAULT 35 CHECK(capacity_hours BETWEEN 0 AND 168);
CREATE TABLE absences(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,user_id TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,CHECK(end_date>=start_date),FOREIGN KEY(org_id,user_id) REFERENCES memberships(org_id,user_id));
