INSERT OR IGNORE INTO project_members(org_id,project_id,user_id)
SELECT p.org_id,p.id,m.user_id FROM projects p JOIN memberships m ON m.org_id=p.org_id WHERE m.role='org_admin';
CREATE TRIGGER project_administrators_after_project AFTER INSERT ON projects BEGIN
 INSERT OR IGNORE INTO project_members(org_id,project_id,user_id) SELECT NEW.org_id,NEW.id,user_id FROM memberships WHERE org_id=NEW.org_id AND role='org_admin';
END;
CREATE TRIGGER project_administrators_after_membership AFTER INSERT ON memberships WHEN NEW.role='org_admin' BEGIN
 INSERT OR IGNORE INTO project_members(org_id,project_id,user_id) SELECT NEW.org_id,id,NEW.user_id FROM projects WHERE org_id=NEW.org_id;
END;
CREATE TRIGGER project_administrators_after_promotion AFTER UPDATE OF role ON memberships WHEN NEW.role='org_admin' BEGIN
 INSERT OR IGNORE INTO project_members(org_id,project_id,user_id) SELECT NEW.org_id,id,NEW.user_id FROM projects WHERE org_id=NEW.org_id;
END;
