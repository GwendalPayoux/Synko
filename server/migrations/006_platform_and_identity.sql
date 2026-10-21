ALTER TABLE users ADD COLUMN disabled_at TEXT;
ALTER TABLE organizations ADD COLUMN suspended_at TEXT;
ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT 'folder';
ALTER TABLE notifications ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'project' CHECK(entity_type IN ('project','task','document','event'));
UPDATE notifications SET entity_type=CASE WHEN EXISTS(SELECT 1 FROM tasks t WHERE t.id=notifications.entity_id AND t.org_id=notifications.org_id AND t.project_id=notifications.project_id) THEN 'task' WHEN EXISTS(SELECT 1 FROM documents d WHERE d.id=notifications.entity_id AND d.org_id=notifications.org_id AND d.project_id=notifications.project_id) THEN 'document' WHEN EXISTS(SELECT 1 FROM events e WHERE e.id=notifications.entity_id AND e.org_id=notifications.org_id AND e.project_id=notifications.project_id) THEN 'event' ELSE 'project' END;
