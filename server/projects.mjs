import { randomUUID } from 'node:crypto';
import { transaction } from './database.mjs';
import { HttpError, text, date, integer, choice } from './security.mjs';
export const projectIcons = [
  'folder',
  'rocket',
  'briefcase',
  'code',
  'calendar',
  'megaphone',
  'building',
  'settings',
  'leaf',
  'flag',
  'lightbulb',
  'users',
];
export function createProjectRecord({ db, one, run, audit, beforeCreate }, s, b) {
  const name = text(b.name, 'Nom du projet', 160),
    start = date(b.start_date, 'Date de début');
  const template = b.template_id
    ? one(
        'SELECT * FROM templates WHERE id=? AND org_id=?',
        text(b.template_id, 'Modèle', 200),
        s.org_id,
      )
    : null;
  if (b.template_id && !template) throw new HttpError(404, 'Modèle introuvable.');
  const structure = template ? JSON.parse(template.structure) : null;
  const offset = (n) =>
    date(
      new Date(Date.parse(start) + n * 86400000).toISOString().slice(0, 10),
      'Date issue du modèle',
    );
  const duration = structure
    ? Math.max(structure.duration, ...structure.tasks.map((t) => t.end))
    : 30;
  const end = date(b.end_date || offset(duration), 'Échéance');
  if (end < start || (structure && end < offset(duration)))
    throw new HttpError(422, 'L’échéance doit inclure toutes les tâches du modèle.');
  const owner = b.owner_id || s.user_id;
  if (s.role === 'project_manager' && owner !== s.user_id)
    throw new HttpError(403, 'Vous devez être responsable du projet créé.');
  const membership = one(
    'SELECT m.role,u.disabled_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?',
    s.org_id,
    owner,
  );
  if (
    !membership ||
    membership.disabled_at ||
    !['org_admin', 'project_manager'].includes(membership.role)
  )
    throw new HttpError(422, 'Choisissez un responsable actif de cette entreprise.');
  const budget = integer(b.budget_cents ?? 0, 0, 100000000000, 'Budget'),
    color = choice(b.color || 'sage', ['sage', 'clay', 'blue', 'violet'], 'Couleur'),
    icon = choice(b.icon || structure?.icon || 'folder', projectIcons, 'Icône');
  const status = choice(b.status || 'active', ['active', 'paused', 'completed'], 'Statut');
  const description =
      typeof b.description === 'string'
        ? b.description.slice(0, 2000)
        : template?.description || '',
    id = randomUUID(),
    stamp = new Date().toISOString();
  transaction(db, () => {
    beforeCreate?.();
    run(
      'INSERT INTO projects(id,org_id,name,description,owner_id,start_date,end_date,budget_cents,color,icon,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      id,
      s.org_id,
      name,
      description,
      owner,
      start,
      end,
      budget,
      color,
      icon,
      status,
      stamp,
    );
    run('INSERT OR IGNORE INTO project_members VALUES (?,?,?)', s.org_id, id, owner);
    if (structure) {
      const ids = new Map(structure.tasks.map((t) => [t.id, randomUUID()]));
      for (const t of structure.tasks)
        run(
          'INSERT INTO tasks(id,org_id,project_id,title,description,start_date,end_date,priority,milestone,effort_hours,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          ids.get(t.id),
          s.org_id,
          id,
          t.title,
          t.description,
          offset(t.start),
          offset(t.end),
          t.priority,
          t.milestone,
          t.effort_hours,
          stamp,
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
      const folders = new Map(structure.folders.map((f) => [f.id, randomUUID()]));
      for (const f of structure.folders)
        run(
          'INSERT INTO folders(id,org_id,project_id,name) VALUES (?,?,?,?)',
          folders.get(f.id),
          s.org_id,
          id,
          f.name,
        );
      for (const f of structure.folders)
        if (f.parent_id)
          run(
            'UPDATE folders SET parent_id=? WHERE id=?',
            folders.get(f.parent_id),
            folders.get(f.id),
          );
    }
    audit(s, id, template ? 'Projet créé depuis un modèle' : 'Projet créé', id);
  });
  return { id };
}
