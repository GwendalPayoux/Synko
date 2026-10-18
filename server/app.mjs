import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { openDatabase, transaction } from './database.mjs';
import { businessModules } from './modules.mjs';
import { accountsModule } from './accounts.mjs';
import { seedTemplates } from './templates.mjs';
import {
  HttpError,
  token,
  hash,
  passwordHash,
  passwordMatches,
  text,
  email,
  password,
  date,
  choice,
  integer,
  requirePermission,
  permissions,
} from './security.mjs';
const now = () => new Date().toISOString();
const statuses = ['todo', 'doing', 'review', 'done'];
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};
async function body(req, limit = 65536) {
  let chunks = [],
    size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Fichier ou requête trop volumineux.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function payload(req) {
  try {
    const value = JSON.parse((await body(req)).toString() || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new HttpError(422, 'Un objet JSON est requis.');
    return value;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'Requête JSON invalide.');
  }
}
export function createApp({
  directory = resolve('data'),
  origin = 'http://localhost:5173',
  secure = false,
  registration = true,
  dist = resolve('dist'),
  mailMode = 'disabled',
} = {}) {
  const db = openDatabase(directory);
  const files = join(directory, 'files');
  mkdirSync(files, { recursive: true });
  const attempts = new Map();
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  transaction(db, () => {
    for (const o of all(
      "SELECT org_id,user_id FROM memberships WHERE role='org_admin' GROUP BY org_id",
    ))
      seedTemplates(run, o.org_id, o.user_id);
  });
  function session(req) {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('synko_session='))
      ?.slice(14);
    const s =
      cookie &&
      one(
        'SELECT s.*,u.name,u.email,u.email_verified_at,u.platform_admin,m.role,o.name org_name FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=s.user_id AND m.org_id=s.org_id JOIN organizations o ON o.id=s.org_id WHERE s.id=? AND s.expires_at>?',
        hash(cookie),
        Date.now(),
      );
    if (!s) throw new HttpError(401, 'Veuillez vous connecter.');
    return s;
  }
  function user(s) {
    return {
      id: s.user_id,
      name: s.name,
      email: s.email,
      org_id: s.org_id,
      org_name: s.org_name,
      role: s.role,
      permissions: permissions[s.role],
      email_verified: !!s.email_verified_at,
      platform_admin: !!s.platform_admin,
    };
  }
  function setSession(res, userId, orgId) {
    const secret = token();
    run('DELETE FROM sessions WHERE expires_at<?', Date.now());
    run(
      'INSERT INTO sessions VALUES (?,?,?,?)',
      hash(secret),
      userId,
      orgId,
      Date.now() + 7 * 86400000,
    );
    res.setHeader(
      'Set-Cookie',
      `synko_session=${secret}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure ? '; Secure' : ''}`,
    );
    return secret;
  }
  function project(s, id) {
    const p = one('SELECT * FROM projects WHERE id=? AND org_id=?', id, s.org_id);
    if (!p) throw new HttpError(404, 'Projet introuvable.');
    if (
      !['org_admin', 'pmo'].includes(s.role) &&
      !one(
        'SELECT user_id FROM project_members WHERE project_id=? AND org_id=? AND user_id=?',
        id,
        s.org_id,
        s.user_id,
      )
    )
      throw new HttpError(404, 'Projet introuvable.');
    return p;
  }
  function projectWrite(s, p) {
    requirePermission(s, 'project:write');
    if (s.role === 'project_manager' && p.owner_id !== s.user_id)
      throw new HttpError(403, 'Seul le responsable peut modifier ce projet.');
  }
  function publicProject(p, s) {
    if (s.role !== 'reader') return p;
    const { budget_cents, ...shared } = p;
    return shared;
  }
  function taskWrite(s, p, t) {
    if (s.role === 'contributor') {
      if (t.assignee_id !== s.user_id)
        throw new HttpError(403, 'Cette tâche ne vous est pas affectée.');
    } else projectWrite(s, p);
  }
  function audit(s, p, action, id) {
    run(
      'INSERT INTO activity VALUES (?,?,?,?,?,?,?)',
      randomUUID(),
      s.org_id,
      p,
      s.user_id,
      action,
      id,
      now(),
    );
    if (action === 'Tâche créée' || action === 'Tâche mise à jour') {
      const t = one('SELECT * FROM tasks WHERE id=? AND org_id=?', id, s.org_id);
      if (t?.assignee_id && t.assignee_id !== s.user_id)
        modules.notify(
          s,
          t.assignee_id,
          p,
          `Tâche ${action === 'Tâche créée' ? 'attribuée' : 'modifiée'} : ${t.title}`,
          id,
          `task:${id}:${t.revision}`,
        );
    }
  }
  const modules = businessModules({
    db,
    one,
    all,
    run,
    project,
    projectWrite,
    audit,
    payload,
    json,
    files,
  });
  const accounts = accountsModule({
    db,
    one,
    all,
    run,
    payload,
    json,
    directory,
    origin,
    mailMode,
  });
  function taskInput(b, s, p) {
    const start = date(b.start_date, 'Date de début'),
      end = date(b.end_date, 'Date de fin');
    if (end < start) throw new HttpError(422, 'La fin doit suivre le début.');
    const assignee = b.assignee_id || null;
    if (
      assignee &&
      !one(
        'SELECT user_id FROM project_members WHERE org_id=? AND project_id=? AND user_id=?',
        s.org_id,
        p,
        assignee,
      )
    )
      throw new HttpError(422, 'Le responsable doit être membre du projet.');
    const milestone = b.milestone === true || b.milestone === 1 ? 1 : 0;
    if (milestone && start !== end)
      throw new HttpError(422, 'Un jalon doit avoir une date unique.');
    return {
      title: text(b.title, 'Titre'),
      description: typeof b.description === 'string' ? b.description.slice(0, 10000) : '',
      assignee_id: assignee,
      start_date: start,
      end_date: end,
      status: choice(b.status || 'todo', statuses, 'Statut'),
      priority: choice(b.priority || 'normal', ['low', 'normal', 'high'], 'Priorité'),
      progress: integer(b.status === 'done' ? 100 : (b.progress ?? 0), 0, 100, 'Progression'),
      milestone,
    };
  }
  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      if (path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(method) && req.headers.origin !== origin)
          throw new HttpError(403, 'Origine de la requête non autorisée.');
        if (path === '/api/health' && method === 'GET') return json(res, 200, { ok: true });
        if (
          method === 'POST' &&
          ['/api/auth/forgot', '/api/auth/reset', '/api/auth/verify'].includes(path)
        ) {
          const key = req.socket.remoteAddress + ':recovery',
            stamp = Date.now();
          let rate = attempts.get(key);
          if (!rate || rate.until < stamp) {
            rate = { count: 0, until: stamp + 900000 };
            attempts.set(key, rate);
          }
          if (++rate.count > 20)
            throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
        }
        if (await accounts.publicRoute(req, res, url)) return;
        if (
          ['/api/auth/register', '/api/auth/login', '/api/auth/accept'].includes(path) &&
          method === 'POST'
        ) {
          const key = req.socket.remoteAddress;
          const stamp = Date.now();
          if (attempts.size > 10000)
            for (const [k, v] of attempts) if (v.until < stamp) attempts.delete(k);
          let rate = attempts.get(key);
          if (!rate || rate.until < stamp) {
            rate = { count: 0, until: stamp + 900000 };
            attempts.set(key, rate);
          }
          if (++rate.count > 30)
            throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
          const b = await payload(req);
          const address = email(b.email);
          const pass = password(b.password);
          if (path === '/api/auth/login') {
            const u = one('SELECT * FROM users WHERE email=?', address);
            const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
            const valid = await passwordMatches(pass, u?.password_hash || dummy);
            if (!u || !valid) throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect.');
            const membership = one(
              'SELECT org_id FROM memberships WHERE user_id=? ORDER BY org_id LIMIT 1',
              u.id,
            );
            setSession(res, u.id, membership.org_id);
            return json(res, 200, { ok: true });
          }
          if (one('SELECT id FROM users WHERE email=?', address))
            throw new HttpError(409, 'Ce compte existe déjà. Connectez-vous.');
          const name = text(b.name, 'Nom', 100);
          const encrypted = await passwordHash(pass);
          const id = randomUUID();
          if (path === '/api/auth/accept') {
            const inv = one(
              'SELECT * FROM invitations WHERE token_hash=? AND expires_at>?',
              hash(text(b.token, 'Invitation', 128)),
              Date.now(),
            );
            if (!inv || inv.email !== address)
              throw new HttpError(422, 'Invitation invalide ou expirée.');
            transaction(db, () => {
              run(
                'INSERT INTO users(id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)',
                id,
                address,
                name,
                encrypted,
                now(),
              );
              run(
                'INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,?)',
                inv.org_id,
                id,
                inv.role,
              );
              run('DELETE FROM invitations WHERE id=?', inv.id);
            });
            setSession(res, id, inv.org_id);
            return json(res, 201, { ok: true });
          }
          if (!registration)
            throw new HttpError(403, 'Les inscriptions sont fermées. Demandez une invitation.');
          const org = text(b.organization, 'Entreprise', 120);
          const orgId = randomUUID();
          transaction(db, () => {
            run('INSERT INTO organizations VALUES (?,?,?)', orgId, org, now());
            run(
              'INSERT INTO users(id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)',
              id,
              address,
              name,
              encrypted,
              now(),
            );
            run(
              'INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,?)',
              orgId,
              id,
              'org_admin',
            );
            seedTemplates(run, orgId, id);
          });
          setSession(res, id, orgId);
          return json(res, 201, { ok: true });
        }
        const s = session(req);
        if (await accounts.route(req, res, url, s)) return;
        if (await modules.route(req, res, url, s)) return;
        if (path === '/api/me' && method === 'GET') return json(res, 200, user(s));
        if (path === '/api/auth/logout' && method === 'POST') {
          run('DELETE FROM sessions WHERE id=?', s.id);
          res.setHeader('Set-Cookie', 'synko_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
          return json(res, 200, { ok: true });
        }
        if (path === '/api/auth/logout-all' && method === 'POST') {
          run('DELETE FROM sessions WHERE user_id=?', s.user_id);
          return json(res, 200, { ok: true });
        }
        if (path === '/api/me' && method === 'PATCH') {
          const b = await payload(req);
          run('UPDATE users SET name=? WHERE id=?', text(b.name, 'Nom', 100), s.user_id);
          return json(res, 200, { ok: true });
        }
        if (path === '/api/members' && method === 'GET')
          return json(
            res,
            200,
            all(
              "SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND (? <> 'reader' OR u.id=?)",
              s.org_id,
              s.role,
              s.user_id,
            ),
          );
        if (path === '/api/invitations' && method === 'POST') {
          requirePermission(s, 'members:write');
          const b = await payload(req);
          const secret = token();
          run(
            'INSERT INTO invitations VALUES (?,?,?,?,?,?,?)',
            randomUUID(),
            s.org_id,
            email(b.email),
            choice(b.role, ['project_manager', 'pmo', 'contributor', 'reader'], 'Rôle'),
            hash(secret),
            Date.now() + 3 * 86400000,
            now(),
          );
          return json(res, 201, { url: `${origin}/?invitation=${secret}`, expires_in_hours: 72 });
        }
        if (path === '/api/projects' && method === 'GET')
          return json(
            res,
            200,
            all(
              `SELECT p.*,u.name owner_name,(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) task_count,COALESCE((SELECT ROUND(AVG(progress)) FROM tasks t WHERE t.project_id=p.id),0) progress FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.org_id=? ${url.searchParams.get('archived') === 'true' ? '' : 'AND p.archived_at IS NULL'} ${['org_admin', 'pmo'].includes(s.role) ? '' : 'AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?)'} ORDER BY p.created_at DESC`,
              ...(['org_admin', 'pmo'].includes(s.role) ? [s.org_id] : [s.org_id, s.user_id]),
            ).map((p) => publicProject(p, s)),
          );
        if (path === '/api/projects' && method === 'POST') {
          requirePermission(s, 'project:create');
          const b = await payload(req);
          const id = randomUUID(),
            start = date(b.start_date, 'Début'),
            end = date(b.end_date, 'Fin');
          if (end < start) throw new HttpError(422, 'Dates incohérentes.');
          const name = text(b.name, 'Nom du projet', 160),
            description = typeof b.description === 'string' ? b.description.slice(0, 2000) : '';
          const budget = integer(b.budget_cents ?? 0, 0, 100000000000, 'Budget');
          transaction(db, () => {
            run(
              'INSERT INTO projects(id,org_id,name,description,owner_id,start_date,end_date,budget_cents,color,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
              id,
              s.org_id,
              name,
              description,
              s.user_id,
              start,
              end,
              budget,
              choice(b.color || 'sage', ['sage', 'clay', 'blue', 'violet'], 'Couleur'),
              now(),
            );
            run('INSERT INTO project_members VALUES (?,?,?)', s.org_id, id, s.user_id);
            audit(s, id, 'Projet créé', id);
          });
          return json(res, 201, { id });
        }
        if (path === '/api/tasks' && method === 'GET')
          return json(
            res,
            200,
            all(
              `SELECT t.*,p.name project_name,p.color FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.org_id=? AND p.archived_at IS NULL AND t.assignee_id=? AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=t.project_id AND pm.user_id=?) ORDER BY t.end_date`,
              s.org_id,
              s.user_id,
              s.user_id,
            ),
          );
        const match = path.match(
          /^\/api\/projects\/([^/]+)(?:\/(tasks|members|documents|activity)(?:\/([^/]+))?(?:\/(versions)(?:\/([^/]+))?)?)?$/,
        );
        if (match) {
          const [, id, resource, entity, versionResource, versionId] = match;
          const p = project(s, id);
          if (!resource && method === 'GET') return json(res, 200, publicProject(p, s));
          if (!resource && method === 'PATCH') {
            projectWrite(s, p);
            const b = await payload(req);
            const status = choice(b.status, ['active', 'paused', 'completed'], 'Statut');
            transaction(db, () => {
              run('UPDATE projects SET status=? WHERE id=? AND org_id=?', status, id, s.org_id);
              audit(s, id, 'Statut du projet modifié', id);
            });
            return json(res, 200, { ok: true });
          }
          if (resource === 'members' && method === 'GET')
            return json(
              res,
              200,
              all(
                'SELECT u.id,u.name,u.email,m.role FROM project_members pm JOIN users u ON u.id=pm.user_id JOIN memberships m ON m.org_id=pm.org_id AND m.user_id=pm.user_id WHERE pm.project_id=? AND pm.org_id=?',
                id,
                s.org_id,
              ),
            );
          if (resource === 'members' && method === 'POST') {
            projectWrite(s, p);
            const b = await payload(req);
            if (
              !one(
                'SELECT user_id FROM memberships WHERE org_id=? AND user_id=?',
                s.org_id,
                b.user_id,
              )
            )
              throw new HttpError(422, 'Membre introuvable.');
            transaction(db, () => {
              run('INSERT OR IGNORE INTO project_members VALUES (?,?,?)', s.org_id, id, b.user_id);
              audit(s, id, 'Membre ajouté', b.user_id);
            });
            return json(res, 201, { ok: true });
          }
          if (resource === 'activity' && method === 'GET')
            return json(
              res,
              200,
              all(
                'SELECT a.*,u.name actor_name FROM activity a JOIN users u ON u.id=a.actor_id WHERE a.org_id=? AND a.project_id=? ORDER BY a.created_at DESC LIMIT 100',
                s.org_id,
                id,
              ),
            );
          if (resource === 'tasks' && method === 'GET' && !entity)
            return json(
              res,
              200,
              all(
                'SELECT t.*,u.name assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.org_id=? AND t.project_id=? ORDER BY t.start_date,t.created_at',
                s.org_id,
                id,
              ),
            );
          if (resource === 'tasks' && method === 'POST' && !entity) {
            projectWrite(s, p);
            const t = taskInput(await payload(req), s, id),
              tid = randomUUID();
            transaction(db, () => {
              run(
                'INSERT INTO tasks(id,org_id,project_id,title,description,assignee_id,start_date,end_date,status,priority,progress,milestone,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                tid,
                s.org_id,
                id,
                t.title,
                t.description,
                t.assignee_id,
                t.start_date,
                t.end_date,
                t.status,
                t.priority,
                t.progress,
                t.milestone,
                now(),
              );
              audit(s, id, 'Tâche créée', tid);
            });
            return json(res, 201, { id: tid });
          }
          if (resource === 'tasks' && entity) {
            const t = one(
              'SELECT * FROM tasks WHERE org_id=? AND project_id=? AND id=?',
              s.org_id,
              id,
              entity,
            );
            if (!t) throw new HttpError(404, 'Tâche introuvable.');
            taskWrite(s, p, t);
            if (method === 'PATCH') {
              const b = await payload(req);
              if (b.revision !== t.revision)
                throw new HttpError(
                  409,
                  'Cette tâche a été modifiée. Rechargez les données avant de réessayer.',
                );
              if (
                s.role === 'contributor' &&
                Object.keys(b).some((k) => !['status', 'progress', 'revision'].includes(k))
              )
                throw new HttpError(
                  403,
                  'Vous pouvez actualiser uniquement le statut et la progression.',
                );
              const v = taskInput({ ...t, ...b }, s, id);
              transaction(db, () => {
                if (
                  one('SELECT revision FROM tasks WHERE id=? AND org_id=?', entity, s.org_id)
                    ?.revision !== b.revision
                )
                  throw new HttpError(409, 'Cette tâche a été modifiée. Rechargez les données.');
                run(
                  'UPDATE tasks SET title=?,description=?,assignee_id=?,start_date=?,end_date=?,status=?,priority=?,progress=?,milestone=?,revision=revision+1 WHERE id=? AND org_id=?',
                  v.title,
                  v.description,
                  v.assignee_id,
                  v.start_date,
                  v.end_date,
                  v.status,
                  v.priority,
                  v.progress,
                  v.milestone,
                  entity,
                  s.org_id,
                );
                audit(s, id, 'Tâche mise à jour', entity);
              });
              return json(res, 200, { ok: true });
            }
            if (method === 'DELETE') {
              projectWrite(s, p);
              if (one('SELECT id FROM tasks WHERE parent_id=?', entity))
                throw new HttpError(
                  422,
                  'Déplacez ou supprimez les sous-tâches avant cette suppression.',
                );
              transaction(db, () => {
                run('DELETE FROM tasks WHERE id=? AND org_id=?', entity, s.org_id);
                audit(s, id, 'Tâche supprimée', entity);
              });
              return json(res, 200, { ok: true });
            }
          }
          if (resource === 'documents') {
            if (!entity && method === 'GET')
              return json(
                res,
                200,
                all(
                  "SELECT d.*,v.id version_id,v.version,v.size,v.created_at updated_at FROM documents d JOIN document_versions v ON v.document_id=d.id WHERE d.org_id=? AND d.project_id=? AND (?<>'reader' OR d.audience='project') AND v.version=(SELECT MAX(version) FROM document_versions WHERE document_id=d.id) ORDER BY v.created_at DESC",
                  s.org_id,
                  id,
                  s.role,
                ),
              );
            const doc = entity
              ? one(
                  'SELECT * FROM documents WHERE id=? AND org_id=? AND project_id=?',
                  entity,
                  s.org_id,
                  id,
                )
              : null;
            if (entity) modules.document(s, id, entity);
            if (method === 'GET' && entity && versionResource && !versionId)
              return json(
                res,
                200,
                all(
                  'SELECT id,version,size,sha256,created_at FROM document_versions WHERE document_id=? AND org_id=? ORDER BY version DESC',
                  entity,
                  s.org_id,
                ),
              );
            if (method === 'GET' && versionId) {
              const v = one(
                'SELECT * FROM document_versions WHERE id=? AND document_id=? AND org_id=?',
                versionId,
                entity,
                s.org_id,
              );
              if (!v) throw new HttpError(404, 'Version introuvable.');
              const bytes = readFileSync(join(files, v.storage_key));
              audit(s, id, 'Version documentaire téléchargée', doc.id);
              res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
                'Content-Length': bytes.length,
              });
              return res.end(bytes);
            }
            if (method === 'POST' && (!entity || versionResource)) {
              requirePermission(s, 'document:write');
              const name = doc?.name || text(url.searchParams.get('name'), 'Nom du fichier', 180);
              const folderId = url.searchParams.get('folder_id') || null;
              if (
                !doc &&
                folderId &&
                !one(
                  'SELECT id FROM folders WHERE org_id=? AND project_id=? AND id=?',
                  s.org_id,
                  id,
                  folderId,
                )
              )
                throw new HttpError(422, 'Dossier introuvable.');
              if (/[\x00-\x1f/\\]/.test(name)) throw new HttpError(422, 'Nom de fichier invalide.');
              const bytes = await body(req, 20 * 1024 * 1024);
              if (!bytes.length) throw new HttpError(422, 'Le fichier est vide.');
              const did = doc?.id || randomUUID(),
                vid = randomUUID(),
                key = randomUUID();
              writeFileSync(join(files, key), bytes, { flag: 'wx' });
              try {
                transaction(db, () => {
                  if (!doc)
                    run(
                      'INSERT INTO documents(id,org_id,project_id,name,created_at,folder_id) VALUES (?,?,?,?,?,?)',
                      did,
                      s.org_id,
                      id,
                      name,
                      now(),
                      folderId,
                    );
                  const next = one(
                    'SELECT COALESCE(MAX(version),0)+1 n FROM document_versions WHERE document_id=?',
                    did,
                  ).n;
                  run(
                    'INSERT INTO document_versions VALUES (?,?,?,?,?,?,?,?,?,?)',
                    vid,
                    s.org_id,
                    id,
                    did,
                    next,
                    key,
                    bytes.length,
                    hash(bytes),
                    s.user_id,
                    now(),
                  );
                  audit(s, id, doc ? 'Version documentaire ajoutée' : 'Document importé', did);
                });
              } catch (e) {
                unlinkSync(join(files, key));
                throw e;
              }
              return json(res, 201, { id: did });
            }
          }
        }
        throw new HttpError(404, 'Ressource introuvable.');
      }
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Méthode non autorisée.');
      const requested = resolve(dist, '.' + decodeURIComponent(path));
      const target =
        requested.startsWith(dist + '\\') || requested.startsWith(dist + '/') ? requested : null;
      const file =
        target && existsSync(target) && extname(target) ? target : join(dist, 'index.html');
      if (!existsSync(file))
        throw new HttpError(404, 'Interface non compilée. Lancez pnpm dev ou pnpm build.');
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
      };
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(JSON.stringify({ requestId, message: error.message }));
      if (!res.headersSent)
        json(res, status, {
          error: status === 500 ? 'Une erreur interne est survenue.' : error.message,
          request_id: requestId,
        });
      else res.end();
    }
  });
  return { server, db };
}
