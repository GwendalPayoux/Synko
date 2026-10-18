import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { HttpError, text, date, choice, integer, requirePermission, hash } from './security.mjs';
import { transaction } from './database.mjs';
import { assertAcyclic, planningSummary, budgetSummary } from './planning.mjs';
import { weeklyWorkload } from './workload.mjs';
const now = () => new Date().toISOString();
const roles = ['org_admin', 'project_manager', 'pmo', 'contributor', 'reader'];
export function businessModules(ctx) {
  const { db, one, all, run, project, projectWrite, audit, payload, json, files } = ctx;
  const notify = (s, userId, p, title, entity, key) =>
    run(
      'INSERT OR IGNORE INTO notifications VALUES (?,?,?,?,?,?,?,NULL,?)',
      randomUUID(),
      s.org_id,
      userId,
      p,
      title,
      entity,
      key,
      now(),
    );
  function document(s, p, id) {
    const d = one(
      'SELECT * FROM documents WHERE org_id=? AND project_id=? AND id=?',
      s.org_id,
      p,
      id,
    );
    if (!d || (s.role === 'reader' && d.audience === 'internal'))
      throw new HttpError(404, 'Document introuvable.');
    return d;
  }
  function task(s, p, id) {
    const t = one('SELECT * FROM tasks WHERE org_id=? AND project_id=? AND id=?', s.org_id, p, id);
    if (!t) throw new HttpError(404, 'Tâche introuvable.');
    return t;
  }
  function folder(s, p, id) {
    if (
      id &&
      !one('SELECT id FROM folders WHERE org_id=? AND project_id=? AND id=?', s.org_id, p, id)
    )
      throw new HttpError(422, 'Dossier introuvable dans ce projet.');
    return id || null;
  }
  function member(s, p, id) {
    if (
      !one(
        'SELECT user_id FROM project_members WHERE org_id=? AND project_id=? AND user_id=?',
        s.org_id,
        p,
        id,
      )
    )
      throw new HttpError(422, 'Cette personne doit appartenir au projet.');
    return id;
  }
  function taskRelations(s, p, t, b) {
    const parent = b.parent_id || null;
    const tasks = all('SELECT * FROM tasks WHERE org_id=? AND project_id=?', s.org_id, p);
    if (parent && !tasks.some((x) => x.id === parent))
      throw new HttpError(422, 'Tâche parente introuvable.');
    assertAcyclic(tasks.map((x) => [x.id, x.id === t ? parent : x.parent_id]).filter((x) => x[1]));
    const predecessors = b.predecessor_ids;
    if (
      !Array.isArray(predecessors) ||
      predecessors.length > 200 ||
      new Set(predecessors).size !== predecessors.length
    )
      throw new HttpError(422, 'Liste de dépendances invalide.');
    for (const id of predecessors) task(s, p, id);
    const existing = all(
      'SELECT * FROM task_dependencies WHERE org_id=? AND project_id=? AND task_id<>?',
      s.org_id,
      p,
      t,
    );
    assertAcyclic([
      ...existing.map((d) => [d.task_id, d.predecessor_id]),
      ...predecessors.map((id) => [t, id]),
    ]);
    transaction(db, () => {
      if (
        one('SELECT revision FROM tasks WHERE id=? AND org_id=?', t, s.org_id)?.revision !==
        b.revision
      )
        throw new HttpError(409, 'La tâche a changé. Rouvrez-la.');
      run(
        'UPDATE tasks SET parent_id=?,effort_hours=?,revision=revision+1 WHERE id=? AND org_id=?',
        parent,
        integer(b.effort_hours ?? 8, 0, 10000, 'Charge'),
        t,
        s.org_id,
      );
      run('DELETE FROM task_dependencies WHERE task_id=? AND org_id=?', t, s.org_id);
      for (const id of predecessors)
        run('INSERT INTO task_dependencies VALUES (?,?,?,?)', s.org_id, p, t, id);
      audit(s, p, 'Relations et charge mises à jour', t);
    });
  }
  return {
    notify,
    document,
    async route(req, res, url, s) {
      const path = url.pathname,
        method = req.method;
      if (path === '/api/capacity' && method === 'PATCH') {
        if (s.role === 'reader') throw new HttpError(403, 'Accès interne requis.');
        const b = await payload(req),
          uid = b.user_id || s.user_id;
        if (uid !== s.user_id) requirePermission(s, 'members:write');
        const result = run(
          'UPDATE memberships SET capacity_hours=? WHERE org_id=? AND user_id=?',
          integer(b.capacity_hours, 0, 168, 'Capacité hebdomadaire'),
          s.org_id,
          uid,
        );
        if (!result.changes) throw new HttpError(404, 'Membre introuvable.');
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/availability' && method === 'GET') {
        json(res, 200, {
          members: all(
            "SELECT u.id,u.name,m.capacity_hours FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND (? IN ('org_admin','pmo') OR m.user_id=?)",
            s.org_id,
            s.role,
            s.user_id,
          ),
          absences: all(
            "SELECT a.*,u.name user_name FROM absences a JOIN users u ON u.id=a.user_id WHERE a.org_id=? AND (? IN ('org_admin','pmo') OR a.user_id=?) ORDER BY a.start_date",
            s.org_id,
            s.role,
            s.user_id,
          ),
        });
        return true;
      }
      if (path === '/api/availability' && method === 'POST') {
        if (s.role === 'reader') throw new HttpError(403, 'Accès interne requis.');
        const b = await payload(req),
          uid = b.user_id || s.user_id;
        if (uid !== s.user_id) requirePermission(s, 'members:write');
        if (!one('SELECT 1 FROM memberships WHERE org_id=? AND user_id=?', s.org_id, uid))
          throw new HttpError(422, 'Membre introuvable.');
        const start = date(b.start_date, 'Début'),
          end = date(b.end_date, 'Fin');
        if (end < start) throw new HttpError(422, 'Dates incohérentes.');
        const id = randomUUID();
        run(
          'INSERT INTO absences VALUES (?,?,?,?,?,?,?)',
          id,
          s.org_id,
          uid,
          start,
          end,
          text(b.reason, 'Motif', 200),
          now(),
        );
        json(res, 201, { id });
        return true;
      }
      const absence = path.match(/^\/api\/availability\/([^/]+)$/);
      if (absence && method === 'DELETE') {
        const a = one('SELECT * FROM absences WHERE org_id=? AND id=?', s.org_id, absence[1]);
        if (!a) throw new HttpError(404, 'Indisponibilité introuvable.');
        if (a.user_id !== s.user_id) requirePermission(s, 'members:write');
        run('DELETE FROM absences WHERE id=? AND org_id=?', a.id, s.org_id);
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/portfolio' && method === 'GET') {
        if (!['org_admin', 'pmo'].includes(s.role))
          throw new HttpError(403, 'Vue réservée au PMO et à l’administrateur entreprise.');
        const projects = all(
          'SELECT * FROM projects WHERE org_id=? AND archived_at IS NULL',
          s.org_id,
        );
        const result = projects.map((p) => {
          const tasks = all('SELECT * FROM tasks WHERE org_id=? AND project_id=?', s.org_id, p.id),
            entries = all(
              'SELECT * FROM budget_entries WHERE org_id=? AND project_id=?',
              s.org_id,
              p.id,
            ),
            revisions = all(
              'SELECT * FROM budget_revisions WHERE org_id=? AND project_id=? ORDER BY created_at DESC,rowid DESC',
              s.org_id,
              p.id,
            );
          const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
          return {
            ...p,
            progress: tasks.length
              ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
              : 0,
            overdue: tasks.filter((t) => t.status !== 'done' && t.end_date < day).length,
            budget: budgetSummary(p, entries, revisions),
          };
        });
        json(res, 200, result);
        return true;
      }
      if (path === '/api/organizations' && method === 'GET') {
        json(
          res,
          200,
          all(
            'SELECT o.id,o.name,m.role FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=?',
            s.user_id,
          ),
        );
        return true;
      }
      if (path === '/api/organizations/switch' && method === 'POST') {
        const b = await payload(req);
        if (!one('SELECT 1 FROM memberships WHERE user_id=? AND org_id=?', s.user_id, b.org_id))
          throw new HttpError(403, 'Organisation non autorisée.');
        run('UPDATE sessions SET org_id=? WHERE id=?', b.org_id, s.id);
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/invitations/accept-existing' && method === 'POST') {
        const b = await payload(req);
        const invitation = one(
          'SELECT * FROM invitations WHERE token_hash=? AND expires_at>?',
          hash(text(b.token, 'Invitation', 128)),
          Date.now(),
        );
        if (!invitation || invitation.email !== s.email)
          throw new HttpError(422, 'Invitation invalide pour ce compte.');
        transaction(db, () => {
          run(
            'INSERT OR IGNORE INTO memberships(org_id,user_id,role) VALUES (?,?,?)',
            invitation.org_id,
            s.user_id,
            invitation.role,
          );
          run('DELETE FROM invitations WHERE id=?', invitation.id);
          run('UPDATE sessions SET org_id=? WHERE id=?', invitation.org_id, s.id);
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/sessions' && method === 'GET') {
        json(
          res,
          200,
          all(
            'SELECT id,expires_at FROM sessions WHERE user_id=? AND expires_at>?',
            s.user_id,
            Date.now(),
          ).map((x) => ({ ...x, current: x.id === s.id })),
        );
        return true;
      }
      const sm = path.match(/^\/api\/sessions\/([^/]+)$/);
      if (sm && method === 'DELETE') {
        run('DELETE FROM sessions WHERE id=? AND user_id=?', sm[1], s.user_id);
        json(res, 200, { ok: true });
        return true;
      }
      const mm = path.match(/^\/api\/members\/([^/]+)$/);
      if (mm && method === 'PATCH') {
        requirePermission(s, 'members:write');
        const b = await payload(req),
          role = choice(b.role, roles, 'Rôle');
        const m = one('SELECT * FROM memberships WHERE org_id=? AND user_id=?', s.org_id, mm[1]);
        if (!m) throw new HttpError(404, 'Membre introuvable.');
        if (
          m.role === 'org_admin' &&
          role !== 'org_admin' &&
          one("SELECT COUNT(*) n FROM memberships WHERE org_id=? AND role='org_admin'", s.org_id)
            .n < 2
        )
          throw new HttpError(422, 'Conservez au moins un administrateur entreprise.');
        if (
          !['org_admin', 'project_manager'].includes(role) &&
          one('SELECT id FROM projects WHERE org_id=? AND owner_id=?', s.org_id, mm[1])
        )
          throw new HttpError(
            422,
            'Transférez les projets de ce responsable avant de changer son rôle.',
          );
        run('UPDATE memberships SET role=? WHERE org_id=? AND user_id=?', role, s.org_id, mm[1]);
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/notifications' && method === 'GET') {
        const day = new Date().toISOString().slice(0, 10),
          soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        for (const t of all(
          "SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.org_id=? AND t.assignee_id=? AND t.status<>'done' AND t.end_date<=? AND p.archived_at IS NULL AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=t.project_id AND m.user_id=?)",
          s.org_id,
          s.user_id,
          soon,
          s.user_id,
        ))
          notify(
            s,
            s.user_id,
            t.project_id,
            `${t.end_date < day ? 'En retard' : 'Échéance proche'} : ${t.title}`,
            t.id,
            `due:${t.id}:${t.end_date}:${t.end_date < day ? 'late' : 'soon'}`,
          );
        json(
          res,
          200,
          all(
            `SELECT n.*,p.name project_name FROM notifications n JOIN projects p ON p.id=n.project_id WHERE n.org_id=? AND n.user_id=? AND (? IN ('org_admin','pmo') OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=n.project_id AND m.user_id=?)) ORDER BY n.created_at DESC LIMIT 200`,
            s.org_id,
            s.user_id,
            s.role,
            s.user_id,
          ),
        );
        return true;
      }
      const nm = path.match(/^\/api\/notifications\/([^/]+)$/);
      if (nm && method === 'PATCH') {
        const b = await payload(req);
        run(
          'UPDATE notifications SET read_at=? WHERE id=? AND org_id=? AND user_id=?',
          b.read === false ? null : now(),
          nm[1],
          s.org_id,
          s.user_id,
        );
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/events' && method === 'GET') {
        json(
          res,
          200,
          all(
            `SELECT e.*,p.name project_name FROM events e JOIN projects p ON p.id=e.project_id WHERE e.org_id=? AND p.archived_at IS NULL AND (? IN ('org_admin','pmo') OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=e.project_id AND m.user_id=?)) ORDER BY e.start_date`,
            s.org_id,
            s.role,
            s.user_id,
          ),
        );
        return true;
      }
      if (path === '/api/templates' && method === 'GET') {
        json(
          res,
          200,
          all(
            'SELECT id,name,description,created_at FROM templates WHERE org_id=? ORDER BY created_at DESC',
            s.org_id,
          ),
        );
        return true;
      }
      const tm = path.match(/^\/api\/templates\/([^/]+)\/instantiate$/);
      if (tm && method === 'POST') {
        requirePermission(s, 'project:create');
        const source = one('SELECT * FROM templates WHERE id=? AND org_id=?', tm[1], s.org_id);
        if (!source) throw new HttpError(404, 'Modèle introuvable.');
        const b = await payload(req),
          start = date(b.start_date, 'Début'),
          name = text(b.name, 'Nom', 160),
          structure = JSON.parse(source.structure),
          id = randomUUID();
        const shifted = (n) =>
          new Date(Date.parse(start) + n * 86400000).toISOString().slice(0, 10);
        transaction(db, () => {
          run(
            'INSERT INTO projects(id,org_id,name,description,owner_id,start_date,end_date,budget_cents,color,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            id,
            s.org_id,
            name,
            source.description,
            s.user_id,
            start,
            shifted(structure.duration),
            0,
            'sage',
            now(),
          );
          run('INSERT INTO project_members VALUES (?,?,?)', s.org_id, id, s.user_id);
          const ids = new Map(structure.tasks.map((t) => [t.id, randomUUID()]));
          for (const t of structure.tasks)
            run(
              'INSERT INTO tasks(id,org_id,project_id,title,description,start_date,end_date,priority,milestone,effort_hours,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
              ids.get(t.id),
              s.org_id,
              id,
              t.title,
              t.description,
              shifted(t.start),
              shifted(t.end),
              t.priority,
              t.milestone,
              t.effort_hours,
              now(),
            );
          for (const t of structure.tasks)
            if (t.parent_id)
              run('UPDATE tasks SET parent_id=? WHERE id=?', ids.get(t.parent_id), ids.get(t.id));
          for (const d of structure.dependencies)
            run(
              'INSERT INTO task_dependencies VALUES (?,?,?,?)',
              s.org_id,
              id,
              ids.get(d.task_id),
              ids.get(d.predecessor_id),
            );
          const folderIds = new Map(structure.folders.map((f) => [f.id, randomUUID()]));
          for (const f of structure.folders)
            run(
              'INSERT INTO folders(id,org_id,project_id,name) VALUES (?,?,?,?)',
              folderIds.get(f.id),
              s.org_id,
              id,
              f.name,
            );
          for (const f of structure.folders)
            if (f.parent_id)
              run(
                'UPDATE folders SET parent_id=? WHERE id=?',
                folderIds.get(f.parent_id),
                folderIds.get(f.id),
              );
          audit(s, id, 'Projet créé depuis un modèle', id);
        });
        json(res, 201, { id });
        return true;
      }
      const pm = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
      if (!pm) return false;
      const p = project(s, pm[1]),
        pid = p.id,
        tail = pm[2] || '';
      if (!tail && method === 'PATCH') {
        projectWrite(s, p);
        const b = await payload(req);
        const owner = b.owner_id ?? p.owner_id;
        const om = one(
          'SELECT role FROM memberships WHERE org_id=? AND user_id=?',
          s.org_id,
          owner,
        );
        if (!om || !['org_admin', 'project_manager'].includes(om.role))
          throw new HttpError(422, 'Le responsable doit être administrateur ou chef de projet.');
        const start = date(b.start_date ?? p.start_date, 'Début'),
          end = date(b.end_date ?? p.end_date, 'Fin');
        if (end < start) throw new HttpError(422, 'Dates incohérentes.');
        transaction(db, () => {
          run(
            'UPDATE projects SET name=?,description=?,owner_id=?,start_date=?,end_date=?,status=?,color=?,archived_at=? WHERE id=? AND org_id=?',
            text(b.name ?? p.name, 'Nom', 160),
            typeof b.description === 'string' ? b.description.slice(0, 2000) : p.description,
            owner,
            start,
            end,
            choice(b.status ?? p.status, ['active', 'paused', 'completed'], 'Statut'),
            choice(b.color ?? p.color, ['sage', 'clay', 'blue', 'violet'], 'Couleur'),
            b.archived === undefined ? p.archived_at : b.archived ? now() : null,
            pid,
            s.org_id,
          );
          run('INSERT OR IGNORE INTO project_members VALUES (?,?,?)', s.org_id, pid, owner);
          audit(s, pid, b.archived ? 'Projet archivé' : 'Projet modifié', pid);
        });
        json(res, 200, { ok: true });
        return true;
      }
      const rm = tail.match(/^members\/([^/]+)$/);
      if (rm && method === 'DELETE') {
        projectWrite(s, p);
        if (rm[1] === p.owner_id)
          throw new HttpError(422, 'Transférez la responsabilité avant le retrait.');
        transaction(db, () => {
          run(
            'UPDATE tasks SET assignee_id=NULL,revision=revision+1 WHERE org_id=? AND project_id=? AND assignee_id=?',
            s.org_id,
            pid,
            rm[1],
          );
          run(
            "UPDATE approvals SET status='rejected',reason='Membre retiré du projet',decided_at=? WHERE org_id=? AND project_id=? AND reviewer_id=? AND status='pending'",
            now(),
            s.org_id,
            pid,
            rm[1],
          );
          run(
            'DELETE FROM project_members WHERE org_id=? AND project_id=? AND user_id=?',
            s.org_id,
            pid,
            rm[1],
          );
          audit(s, pid, 'Membre retiré et tâches désaffectées', rm[1]);
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (tail === 'planning' && method === 'GET') {
        const tasks = all('SELECT * FROM tasks WHERE org_id=? AND project_id=?', s.org_id, pid);
        json(res, 200, {
          dependencies: planningSummary(
            tasks,
            all('SELECT * FROM task_dependencies WHERE org_id=? AND project_id=?', s.org_id, pid),
          ),
        });
        return true;
      }
      if (tail === 'workload' && method === 'GET') {
        if (s.role === 'reader')
          throw new HttpError(403, 'La charge de travail est réservée à l’équipe interne.');
        const members = all(
            'SELECT u.id,u.name,m.capacity_hours FROM project_members pm JOIN memberships m ON m.org_id=pm.org_id AND m.user_id=pm.user_id JOIN users u ON u.id=pm.user_id WHERE pm.org_id=? AND pm.project_id=?',
            s.org_id,
            pid,
          ),
          tasks = all('SELECT * FROM tasks WHERE org_id=? AND project_id=?', s.org_id, pid),
          absences = all('SELECT * FROM absences WHERE org_id=?', s.org_id);
        json(
          res,
          200,
          weeklyWorkload(
            tasks,
            members,
            absences,
            new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }),
          ),
        );
        return true;
      }
      const td = tail.match(/^tasks\/([^/]+)\/details$/);
      if (td) {
        const t = task(s, pid, td[1]);
        if (method === 'GET') {
          json(res, 200, {
            task: t,
            tasks: all(
              'SELECT id,title,parent_id FROM tasks WHERE org_id=? AND project_id=?',
              s.org_id,
              pid,
            ),
            dependencies: all(
              'SELECT predecessor_id FROM task_dependencies WHERE org_id=? AND task_id=?',
              s.org_id,
              t.id,
            ),
            comments: all(
              'SELECT c.*,u.name author_name FROM comments c JOIN users u ON u.id=c.author_id WHERE c.org_id=? AND c.task_id=? ORDER BY c.created_at',
              s.org_id,
              t.id,
            ),
            attachments: all(
              "SELECT d.id,d.name FROM task_documents a JOIN documents d ON d.id=a.document_id WHERE a.org_id=? AND a.task_id=? AND (?<>'reader' OR d.audience='project')",
              s.org_id,
              t.id,
              s.role,
            ),
            history: all(
              'SELECT a.*,u.name actor_name FROM activity a JOIN users u ON u.id=a.actor_id WHERE a.org_id=? AND a.entity_id=? ORDER BY a.created_at DESC LIMIT 50',
              s.org_id,
              t.id,
            ),
          });
          return true;
        }
        if (method === 'PATCH') {
          projectWrite(s, p);
          const b = await payload(req);
          if (b.revision !== t.revision) throw new HttpError(409, 'La tâche a changé. Rouvrez-la.');
          taskRelations(s, pid, t.id, b);
          json(res, 200, { ok: true });
          return true;
        }
      }
      const cm = tail.match(/^(tasks|documents)\/([^/]+)\/comments$/);
      if (cm && method === 'POST') {
        if (s.role === 'reader') throw new HttpError(403, 'Les lecteurs ne peuvent pas commenter.');
        if (cm[1] === 'tasks') task(s, pid, cm[2]);
        else document(s, pid, cm[2]);
        const b = await payload(req),
          id = randomUUID();
        transaction(db, () => {
          run(
            'INSERT INTO comments VALUES (?,?,?,?,?,?,?,?)',
            id,
            s.org_id,
            pid,
            cm[1] === 'tasks' ? cm[2] : null,
            cm[1] === 'documents' ? cm[2] : null,
            s.user_id,
            text(b.body, 'Commentaire', 10000),
            now(),
          );
          audit(s, pid, 'Commentaire ajouté', cm[2]);
        });
        json(res, 201, { id });
        return true;
      }
      const am = tail.match(/^tasks\/([^/]+)\/attachments$/);
      if (am && method === 'POST') {
        task(s, pid, am[1]);
        requirePermission(s, 'document:write');
        const b = await payload(req);
        document(s, pid, b.document_id);
        transaction(db, () => {
          run(
            'INSERT OR IGNORE INTO task_documents VALUES (?,?,?,?)',
            s.org_id,
            pid,
            am[1],
            b.document_id,
          );
          audit(s, pid, 'Document lié à une tâche', am[1]);
        });
        json(res, 201, { ok: true });
        return true;
      }
      if (tail === 'budget' && method === 'GET') {
        if (s.role === 'reader')
          throw new HttpError(403, 'Le budget est réservé à l’équipe interne.');
        const entries = all(
            'SELECT * FROM budget_entries WHERE org_id=? AND project_id=? ORDER BY entry_date DESC,created_at DESC',
            s.org_id,
            pid,
          ),
          revisions = all(
            'SELECT * FROM budget_revisions WHERE org_id=? AND project_id=? ORDER BY created_at DESC,rowid DESC',
            s.org_id,
            pid,
          );
        json(res, 200, { summary: budgetSummary(p, entries, revisions), entries, revisions });
        return true;
      }
      if (tail === 'budget/revisions' && method === 'POST') {
        projectWrite(s, p);
        const b = await payload(req);
        transaction(db, () => {
          run(
            'INSERT INTO budget_revisions VALUES (?,?,?,?,?,?,?)',
            randomUUID(),
            s.org_id,
            pid,
            integer(b.amount_cents, 0, 100000000000, 'Budget'),
            text(b.reason, 'Motif', 1000),
            s.user_id,
            now(),
          );
          audit(s, pid, 'Budget révisé', pid);
        });
        json(res, 201, { ok: true });
        return true;
      }
      if (tail === 'budget/entries' && method === 'POST') {
        projectWrite(s, p);
        const b = await payload(req),
          id = randomUUID();
        transaction(db, () => {
          run(
            'INSERT INTO budget_entries VALUES (?,?,?,?,?,?,?,?,?,?)',
            id,
            s.org_id,
            pid,
            text(b.label, 'Libellé', 200),
            text(b.category, 'Catégorie', 100),
            choice(b.kind, ['actual', 'commitment', 'forecast'], 'Type'),
            integer(b.amount_cents, 0, 100000000000, 'Montant'),
            date(b.entry_date, 'Date'),
            s.user_id,
            now(),
          );
          audit(s, pid, 'Écriture budgétaire ajoutée', id);
        });
        json(res, 201, { id });
        return true;
      }
      const be = tail.match(/^budget\/entries\/([^/]+)$/);
      if (be && method === 'PATCH') {
        projectWrite(s, p);
        const b = await payload(req);
        const e = one(
          'SELECT * FROM budget_entries WHERE org_id=? AND project_id=? AND id=?',
          s.org_id,
          pid,
          be[1],
        );
        if (!e) throw new HttpError(404, 'Écriture introuvable.');
        transaction(db, () => {
          run(
            'UPDATE budget_entries SET kind=? WHERE id=? AND org_id=?',
            choice(b.kind, ['actual', 'commitment', 'forecast'], 'Type'),
            e.id,
            s.org_id,
          );
          audit(s, pid, 'Écriture budgétaire reclassée', e.id);
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (tail === 'events' && method === 'POST') {
        projectWrite(s, p);
        const b = await payload(req),
          start = date(b.start_date, 'Début'),
          end = date(b.end_date, 'Fin');
        if (end < start) throw new HttpError(422, 'Dates incohérentes.');
        const id = randomUUID();
        transaction(db, () => {
          run(
            'INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?)',
            id,
            s.org_id,
            pid,
            text(b.title, 'Titre'),
            typeof b.description === 'string' ? b.description.slice(0, 2000) : '',
            start,
            end,
            choice(b.kind, ['meeting', 'deadline', 'delivery', 'event'], 'Type'),
            s.user_id,
            now(),
          );
          audit(s, pid, 'Événement créé', id);
        });
        json(res, 201, { id });
        return true;
      }
      const ev = tail.match(/^events\/([^/]+)$/);
      if (ev && method === 'DELETE') {
        projectWrite(s, p);
        transaction(db, () => {
          run('DELETE FROM events WHERE id=? AND org_id=? AND project_id=?', ev[1], s.org_id, pid);
          audit(s, pid, 'Événement supprimé', ev[1]);
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (tail === 'template' && method === 'POST') {
        projectWrite(s, p);
        const b = await payload(req),
          tasks = all('SELECT * FROM tasks WHERE org_id=? AND project_id=?', s.org_id, pid),
          id = randomUUID(),
          delta = (d) => Math.round((Date.parse(d) - Date.parse(p.start_date)) / 86400000);
        const structure = {
          duration: delta(p.end_date),
          tasks: tasks.map((t) => ({ ...t, start: delta(t.start_date), end: delta(t.end_date) })),
          dependencies: all(
            'SELECT * FROM task_dependencies WHERE org_id=? AND project_id=?',
            s.org_id,
            pid,
          ),
          folders: all('SELECT * FROM folders WHERE org_id=? AND project_id=?', s.org_id, pid),
        };
        transaction(db, () => {
          run(
            'INSERT INTO templates VALUES (?,?,?,?,?,?,?)',
            id,
            s.org_id,
            text(b.name, 'Nom du modèle', 160),
            p.description,
            JSON.stringify(structure),
            s.user_id,
            now(),
          );
          audit(s, pid, 'Modèle enregistré', id);
        });
        json(res, 201, { id });
        return true;
      }
      if (tail === 'folders' && method === 'GET') {
        json(
          res,
          200,
          all('SELECT * FROM folders WHERE org_id=? AND project_id=? ORDER BY name', s.org_id, pid),
        );
        return true;
      }
      if (tail === 'folders' && method === 'POST') {
        requirePermission(s, 'document:write');
        const b = await payload(req),
          id = randomUUID();
        run(
          'INSERT INTO folders VALUES (?,?,?,?,?)',
          id,
          s.org_id,
          pid,
          text(b.name, 'Nom du dossier', 120),
          folder(s, pid, b.parent_id),
        );
        json(res, 201, { id });
        return true;
      }
      const fm = tail.match(/^folders\/([^/]+)$/);
      if (fm && method === 'PATCH') {
        requirePermission(s, 'document:write');
        folder(s, pid, fm[1]);
        const b = await payload(req);
        const parent = folder(s, pid, b.parent_id);
        const folders = all('SELECT * FROM folders WHERE org_id=? AND project_id=?', s.org_id, pid);
        assertAcyclic(
          folders.map((f) => [f.id, f.id === fm[1] ? parent : f.parent_id]).filter((x) => x[1]),
        );
        run(
          'UPDATE folders SET name=?,parent_id=? WHERE id=? AND org_id=?',
          text(b.name, 'Nom du dossier', 120),
          parent,
          fm[1],
          s.org_id,
        );
        json(res, 200, { ok: true });
        return true;
      }
      const dm = tail.match(/^documents\/([^/]+)(?:\/(details|restore|approvals|preview))?$/);
      if (dm) {
        const d = document(s, pid, dm[1]);
        if (!dm[2] && method === 'PATCH') {
          projectWrite(s, p);
          const b = await payload(req);
          transaction(db, () => {
            run(
              'UPDATE documents SET name=?,folder_id=?,archived_at=?,audience=? WHERE org_id=? AND id=?',
              text(b.name ?? d.name, 'Nom', 180),
              folder(s, pid, b.folder_id === undefined ? d.folder_id : b.folder_id),
              b.archived === undefined ? d.archived_at : b.archived ? now() : null,
              choice(b.audience ?? d.audience, ['project', 'internal'], 'Partage'),
              s.org_id,
              d.id,
            );
            audit(s, pid, 'Métadonnées documentaires modifiées', d.id);
          });
          json(res, 200, { ok: true });
          return true;
        }
        if (dm[2] === 'details' && method === 'GET') {
          json(res, 200, {
            document: d,
            comments: all(
              'SELECT c.*,u.name author_name FROM comments c JOIN users u ON u.id=c.author_id WHERE c.org_id=? AND c.document_id=? ORDER BY c.created_at',
              s.org_id,
              d.id,
            ),
            approvals: all(
              'SELECT a.*,u.name reviewer_name,v.version FROM approvals a JOIN users u ON u.id=a.reviewer_id JOIN document_versions v ON v.id=a.version_id WHERE a.org_id=? AND a.document_id=? ORDER BY a.created_at DESC',
              s.org_id,
              d.id,
            ),
          });
          return true;
        }
        if (dm[2] === 'preview' && method === 'GET') {
          const requestedVersion = url.searchParams.get('version_id');
          const v = requestedVersion
            ? one(
                'SELECT * FROM document_versions WHERE id=? AND document_id=? AND org_id=?',
                requestedVersion,
                d.id,
                s.org_id,
              )
            : one(
                'SELECT * FROM document_versions WHERE document_id=? AND org_id=? ORDER BY version DESC LIMIT 1',
                d.id,
                s.org_id,
              );
          if (!v) throw new HttpError(404, 'Version introuvable.');
          if (url.searchParams.get('format') === 'raw') {
            const bytes = readFileSync(join(files, v.storage_key));
            const signature = bytes.subarray(0, 12);
            let mime = null;
            if (/\.pdf$/i.test(d.name) && signature.subarray(0, 5).toString() === '%PDF-')
              mime = 'application/pdf';
            if (
              /\.png$/i.test(d.name) &&
              signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            )
              mime = 'image/png';
            if (
              /\.jpe?g$/i.test(d.name) &&
              signature[0] === 255 &&
              signature[1] === 216 &&
              signature[2] === 255
            )
              mime = 'image/jpeg';
            if (
              /\.webp$/i.test(d.name) &&
              signature.subarray(0, 4).toString() === 'RIFF' &&
              signature.subarray(8, 12).toString() === 'WEBP'
            )
              mime = 'image/webp';
            if (!mime)
              throw new HttpError(
                422,
                'Aperçu intégré indisponible pour ce format ou signature de fichier invalide.',
              );
            audit(s, pid, 'Version documentaire consultée', d.id);
            res.writeHead(200, {
              'Content-Type': mime,
              'Content-Length': bytes.length,
              'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(d.name)}`,
              'X-Frame-Options': 'SAMEORIGIN',
              'Content-Security-Policy':
                "default-src 'none'; frame-ancestors 'self'; sandbox allow-same-origin",
            });
            res.end(bytes);
            return true;
          }
          if (!/\.(txt|md|csv|json|log)$/i.test(d.name))
            throw new HttpError(
              422,
              'Aperçu texte indisponible pour ce format. Téléchargez le fichier.',
            );
          if (v.size > 1024 * 1024) throw new HttpError(413, 'Aperçu limité à 1 Mo.');
          json(res, 200, { content: readFileSync(join(files, v.storage_key), 'utf8') });
          return true;
        }
        if (dm[2] === 'restore' && method === 'POST') {
          projectWrite(s, p);
          const b = await payload(req),
            v = one(
              'SELECT * FROM document_versions WHERE id=? AND document_id=? AND org_id=?',
              b.version_id,
              d.id,
              s.org_id,
            );
          if (!v) throw new HttpError(404, 'Version introuvable.');
          const key = randomUUID(),
            id = randomUUID();
          writeFileSync(join(files, key), readFileSync(join(files, v.storage_key)), { flag: 'wx' });
          try {
            transaction(db, () => {
              const next = one(
                'SELECT MAX(version)+1 n FROM document_versions WHERE document_id=?',
                d.id,
              ).n;
              run(
                'INSERT INTO document_versions VALUES (?,?,?,?,?,?,?,?,?,?)',
                id,
                s.org_id,
                pid,
                d.id,
                next,
                key,
                v.size,
                v.sha256,
                s.user_id,
                now(),
              );
              audit(s, pid, `Version ${v.version} restaurée`, d.id);
            });
          } catch (e) {
            unlinkSync(join(files, key));
            throw e;
          }
          json(res, 201, { id });
          return true;
        }
        if (dm[2] === 'approvals' && method === 'POST') {
          projectWrite(s, p);
          const b = await payload(req),
            reviewer = member(s, pid, b.reviewer_id);
          const role = one(
            'SELECT role FROM memberships WHERE org_id=? AND user_id=?',
            s.org_id,
            reviewer,
          ).role;
          if (role === 'reader') throw new HttpError(422, 'Choisissez un validateur interne.');
          const v = one(
            'SELECT * FROM document_versions WHERE document_id=? AND org_id=? ORDER BY version DESC LIMIT 1',
            d.id,
            s.org_id,
          );
          if (
            one(
              "SELECT id FROM approvals WHERE version_id=? AND reviewer_id=? AND status='pending'",
              v.id,
              reviewer,
            )
          )
            throw new HttpError(409, 'Une demande est déjà en attente pour cette version.');
          const id = randomUUID();
          transaction(db, () => {
            run(
              'INSERT INTO approvals(id,org_id,project_id,document_id,version_id,reviewer_id,requested_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
              id,
              s.org_id,
              pid,
              d.id,
              v.id,
              reviewer,
              s.user_id,
              now(),
            );
            notify(s, reviewer, pid, `Document à valider : ${d.name}`, d.id, `approval:${id}`);
            audit(s, pid, 'Validation documentaire demandée', d.id);
          });
          json(res, 201, { id });
          return true;
        }
      }
      const ap = tail.match(/^approvals\/([^/]+)$/);
      if (ap && method === 'PATCH') {
        const a = one(
          'SELECT * FROM approvals WHERE id=? AND org_id=? AND project_id=?',
          ap[1],
          s.org_id,
          pid,
        );
        if (!a) throw new HttpError(404, 'Demande introuvable.');
        document(s, pid, a.document_id);
        if (a.reviewer_id !== s.user_id || s.role === 'reader')
          throw new HttpError(403, 'Seul le validateur désigné peut décider.');
        if (a.status !== 'pending')
          throw new HttpError(409, 'Cette décision est déjà enregistrée.');
        const b = await payload(req),
          status = choice(b.status, ['approved', 'rejected'], 'Décision'),
          reason =
            status === 'rejected'
              ? text(b.reason, 'Motif de refus', 2000)
              : typeof b.reason === 'string'
                ? b.reason.slice(0, 2000)
                : '';
        transaction(db, () => {
          if (one('SELECT status FROM approvals WHERE id=?', a.id)?.status !== 'pending')
            throw new HttpError(409, 'Cette décision est déjà enregistrée.');
          run(
            'UPDATE approvals SET status=?,reason=?,decided_at=? WHERE id=?',
            status,
            reason,
            now(),
            a.id,
          );
          notify(
            s,
            a.requested_by,
            pid,
            status === 'approved' ? 'Validation documentaire obtenue' : 'Document refusé',
            a.document_id,
            `decision:${a.id}`,
          );
          audit(
            s,
            pid,
            status === 'approved' ? 'Document approuvé' : 'Document refusé',
            a.document_id,
          );
        });
        json(res, 200, { ok: true });
        return true;
      }
      return false;
    },
  };
}
