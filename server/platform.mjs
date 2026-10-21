import { randomUUID } from 'node:crypto';
import {
  HttpError,
  text,
  email,
  password,
  passwordHash,
  date,
  integer,
  choice,
} from './security.mjs';
import { transaction } from './database.mjs';
import { seedTemplates } from './templates.mjs';
import { createProjectRecord, projectIcons } from './projects.mjs';
const stamp = () => new Date().toISOString(),
  roles = ['org_admin', 'project_manager', 'pmo', 'contributor', 'reader'];
export function platformModule(ctx) {
  const { db, one, all, run, payload, json, audit, security } = ctx;
  function organization(id) {
    const o = one('SELECT * FROM organizations WHERE id=?', text(id, 'Entreprise', 100));
    if (!o) throw new HttpError(404, 'Entreprise introuvable.');
    return o;
  }
  function log(s, org, action) {
    security({ ...s, org_id: org }, 'Plateforme · ' + action);
  }
  function supportMembership(s, org) {
    run(
      "INSERT OR IGNORE INTO memberships(org_id,user_id,role) VALUES (?,?,'org_admin')",
      org,
      s.user_id,
    );
    run("UPDATE memberships SET role='org_admin' WHERE org_id=? AND user_id=?", org, s.user_id);
  }
  function validateRole(uid, org, role) {
    const old = one('SELECT role FROM memberships WHERE org_id=? AND user_id=?', org, uid);
    if (
      old?.role === 'org_admin' &&
      role !== 'org_admin' &&
      one("SELECT COUNT(*) n FROM memberships WHERE org_id=? AND role='org_admin'", org).n < 2
    )
      throw new HttpError(422, 'Conservez au moins un administrateur entreprise.');
    if (
      !['org_admin', 'project_manager'].includes(role) &&
      one('SELECT id FROM projects WHERE org_id=? AND owner_id=?', org, uid)
    )
      throw new HttpError(422, 'Transférez ses projets avant de modifier ce rôle.');
  }
  return async (req, res, url, s) => {
    if (!url.pathname.startsWith('/api/platform/')) return false;
    if (
      !one('SELECT platform_admin FROM users WHERE id=? AND disabled_at IS NULL', s.user_id)
        ?.platform_admin
    )
      throw new HttpError(403, 'Accès réservé aux administrateurs Synko.');
    const route = url.pathname.slice('/api/platform/'.length),
      method = req.method;
    if (route === 'organizations' && method === 'GET') {
      json(
        res,
        200,
        all(
          'SELECT o.id,o.name,o.created_at,o.suspended_at,(SELECT COUNT(*) FROM memberships m WHERE m.org_id=o.id) member_count,(SELECT COUNT(*) FROM projects p WHERE p.org_id=o.id) project_count FROM organizations o ORDER BY o.name',
        ),
      );
      return true;
    }
    if (route === 'organizations' && method === 'POST') {
      const b = await payload(req),
        id = randomUUID(),
        name = text(b.name, 'Nom de l’entreprise', 120),
        admin = b.admin_user_id || s.user_id;
      if (!one('SELECT id FROM users WHERE id=? AND disabled_at IS NULL', admin))
        throw new HttpError(422, 'Administrateur introuvable ou désactivé.');
      transaction(db, () => {
        run('INSERT INTO organizations(id,name,created_at) VALUES (?,?,?)', id, name, stamp());
        run("INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,'org_admin')", id, admin);
        seedTemplates(run, id, admin);
        log(s, id, 'Entreprise créée');
      });
      json(res, 201, { id });
      return true;
    }
    const om = route.match(/^organizations\/([^/]+)(?:\/(access|members))?$/);
    if (om) {
      const org = organization(om[1]);
      if (om[2] === 'access' && method === 'POST') {
        transaction(db, () => {
          supportMembership(s, org.id);
          run('UPDATE sessions SET org_id=? WHERE id=? AND user_id=?', org.id, s.id, s.user_id);
          log(s, org.id, 'Accès administratif explicite à l’espace entreprise');
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (om[2] === 'members' && method === 'GET') {
        json(
          res,
          200,
          all(
            'SELECT u.id,u.name,u.email,u.disabled_at,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? ORDER BY u.name',
            org.id,
          ),
        );
        return true;
      }
      if (!om[2] && method === 'PATCH') {
        const b = await payload(req);
        transaction(db, () => {
          run(
            'UPDATE organizations SET name=?,suspended_at=? WHERE id=?',
            text(b.name ?? org.name, 'Nom', 120),
            b.suspended === undefined ? org.suspended_at : b.suspended ? stamp() : null,
            org.id,
          );
          if (b.suspended)
            run(
              'DELETE FROM sessions WHERE org_id=? AND user_id IN (SELECT id FROM users WHERE platform_admin=0)',
              org.id,
            );
          log(
            s,
            org.id,
            b.suspended
              ? 'Entreprise suspendue'
              : b.suspended === false
                ? 'Entreprise réactivée'
                : 'Entreprise modifiée',
          );
        });
        json(res, 200, { ok: true });
        return true;
      }
    }
    if ((route === 'projects' || route === 'users') && method === 'GET') {
      const org = url.searchParams.get('org_id') || '',
        q = '%' + (url.searchParams.get('q') || '').slice(0, 200) + '%',
        page = integer(Number(url.searchParams.get('page') || 1), 1, 100000, 'Page'),
        limit = 50;
      if (route === 'projects') {
        const sort = choice(
            url.searchParams.get('sort') || 'organization',
            ['organization', 'name', 'end_date', 'created_at', 'status'],
            'Tri',
          ),
          column = {
            organization: 'o.name,p.name',
            name: 'p.name',
            end_date: 'p.end_date',
            created_at: 'p.created_at DESC',
            status: 'p.status',
          }[sort];
        const where = "WHERE (?='' OR p.org_id=?) AND (p.name LIKE ? OR o.name LIKE ?)";
        const params = [org, org, q, q];
        json(res, 200, {
          items: all(
            `SELECT p.*,o.name org_name,u.name owner_name,(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) task_count FROM projects p JOIN organizations o ON o.id=p.org_id JOIN users u ON u.id=p.owner_id ${where} ORDER BY ${column},p.id LIMIT ? OFFSET ?`,
            ...params,
            limit,
            (page - 1) * limit,
          ),
          total: one(
            `SELECT COUNT(*) n FROM projects p JOIN organizations o ON o.id=p.org_id ${where}`,
            ...params,
          ).n,
          page,
        });
      } else {
        const sort = choice(
            url.searchParams.get('sort') || 'name',
            ['name', 'email', 'created_at'],
            'Tri',
          ),
          where =
            "WHERE (?='' OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.org_id=?)) AND (u.name LIKE ? OR u.email LIKE ?)",
          params = [org, org, q, q];
        const items = all(
          `SELECT u.id,u.name,u.email,u.platform_admin,u.disabled_at,u.created_at,u.email_verified_at FROM users u ${where} ORDER BY u.${sort},u.id LIMIT ? OFFSET ?`,
          ...params,
          limit,
          (page - 1) * limit,
        ).map((u) => ({
          ...u,
          memberships: all(
            'SELECT m.org_id,m.role,o.name org_name FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=? ORDER BY o.name',
            u.id,
          ),
        }));
        json(res, 200, {
          items,
          total: one(`SELECT COUNT(*) n FROM users u ${where}`, ...params).n,
          page,
        });
      }
      return true;
    }
    if (route === 'users' && method === 'POST') {
      const b = await payload(req),
        address = email(b.email),
        name = text(b.name, 'Nom', 100),
        org = organization(b.org_id),
        role = choice(b.role, roles, 'Rôle'),
        encrypted = await passwordHash(password(b.password)),
        id = randomUUID();
      transaction(db, () => {
        if (one('SELECT id FROM users WHERE email=?', address))
          throw new HttpError(409, 'Cette adresse possède déjà un compte.');
        run(
          'INSERT INTO users(id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)',
          id,
          address,
          name,
          encrypted,
          stamp(),
        );
        run('INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,?)', org.id, id, role);
        log(s, org.id, `Utilisateur créé : ${id}`);
      });
      json(res, 201, { id });
      return true;
    }
    const um = route.match(/^users\/([^/]+)(?:\/(password|sessions))?$/);
    if (um) {
      const u = one('SELECT id,name,email,platform_admin,disabled_at FROM users WHERE id=?', um[1]);
      if (!u) throw new HttpError(404, 'Utilisateur introuvable.');
      if (um[2] === 'sessions' && method === 'DELETE') {
        run('DELETE FROM sessions WHERE user_id=?', u.id);
        log(s, s.org_id, `Sessions révoquées : ${u.id}`);
        json(res, 200, { ok: true });
        return true;
      }
      if (um[2] === 'password' && method === 'POST') {
        const b = await payload(req),
          encrypted = await passwordHash(password(b.password));
        transaction(db, () => {
          run('UPDATE users SET password_hash=? WHERE id=?', encrypted, u.id);
          run('DELETE FROM sessions WHERE user_id=?', u.id);
          run(
            'UPDATE account_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',
            stamp(),
            u.id,
          );
          log(s, s.org_id, `Mot de passe réinitialisé par un administrateur : ${u.id}`);
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (!um[2] && method === 'PATCH') {
        const b = await payload(req),
          name = text(b.name ?? u.name, 'Nom', 100),
          address = email(b.email ?? u.email),
          operator = b.platform_admin === undefined ? u.platform_admin : b.platform_admin ? 1 : 0,
          disabled = b.disabled === undefined ? u.disabled_at : b.disabled ? stamp() : null;
        const org = b.org_id ? organization(b.org_id) : null,
          role = org ? choice(b.role, roles, 'Rôle') : null;
        transaction(db, () => {
          const current = one('SELECT * FROM users WHERE id=?', u.id);
          if (
            current.platform_admin &&
            !current.disabled_at &&
            (!operator || disabled) &&
            one('SELECT COUNT(*) n FROM users WHERE platform_admin=1 AND disabled_at IS NULL').n < 2
          )
            throw new HttpError(422, 'Conservez au moins un administrateur Synko actif.');
          if (one('SELECT id FROM users WHERE email=? AND id<>?', address, u.id))
            throw new HttpError(409, 'Adresse e-mail déjà utilisée.');
          if (org) validateRole(u.id, org.id, role);
          run(
            'UPDATE users SET name=?,email=?,platform_admin=?,disabled_at=?,email_verified_at=CASE WHEN email=? THEN email_verified_at ELSE NULL END WHERE id=?',
            name,
            address,
            operator,
            disabled,
            address,
            u.id,
          );
          if (org)
            run(
              'INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,?) ON CONFLICT(org_id,user_id) DO UPDATE SET role=excluded.role',
              org.id,
              u.id,
              role,
            );
          if (disabled || operator !== current.platform_admin || address !== current.email) {
            run('DELETE FROM sessions WHERE user_id=?', u.id);
            run(
              'UPDATE account_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',
              stamp(),
              u.id,
            );
          }
          log(s, org?.id || s.org_id, `Utilisateur et droits modifiés : ${u.id}`);
        });
        json(res, 200, { ok: true });
        return true;
      }
    }
    if (route === 'projects' && method === 'POST') {
      const b = await payload(req),
        org = organization(b.org_id),
        scope = { ...s, org_id: org.id, role: 'org_admin' };
      const result = createProjectRecord(
        {
          ...ctx,
          beforeCreate: () => {
            supportMembership(s, org.id);
            log(s, org.id, 'Création de projet en administration');
          },
        },
        scope,
        b,
      );
      json(res, 201, result);
      return true;
    }
    const pm = route.match(/^projects\/([^/]+)$/);
    if (pm && method === 'PATCH') {
      const p = one('SELECT * FROM projects WHERE id=?', pm[1]);
      if (!p) throw new HttpError(404, 'Projet introuvable.');
      const b = await payload(req),
        owner = b.owner_id || p.owner_id,
        start = date(b.start_date ?? p.start_date, 'Début'),
        end = date(b.end_date ?? p.end_date, 'Fin');
      if (end < start) throw new HttpError(422, 'Dates incohérentes.');
      const member = one(
        'SELECT m.role,u.disabled_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?',
        p.org_id,
        owner,
      );
      if (!member || member.disabled_at || !['org_admin', 'project_manager'].includes(member.role))
        throw new HttpError(422, 'Responsable non autorisé dans cette entreprise.');
      transaction(db, () => {
        supportMembership(s, p.org_id);
        run(
          'UPDATE projects SET name=?,description=?,owner_id=?,start_date=?,end_date=?,status=?,budget_cents=?,color=?,icon=?,archived_at=? WHERE id=?',
          text(b.name ?? p.name, 'Nom', 160),
          typeof b.description === 'string' ? b.description.slice(0, 2000) : p.description,
          owner,
          start,
          end,
          choice(b.status ?? p.status, ['active', 'paused', 'completed'], 'Statut'),
          integer(b.budget_cents ?? p.budget_cents, 0, 100000000000, 'Budget'),
          choice(b.color ?? p.color, ['sage', 'clay', 'blue', 'violet'], 'Couleur'),
          choice(b.icon ?? p.icon, projectIcons, 'Icône'),
          b.archived === undefined ? p.archived_at : b.archived ? stamp() : null,
          p.id,
        );
        run('INSERT OR IGNORE INTO project_members VALUES (?,?,?)', p.org_id, p.id, owner);
        audit(
          { ...s, org_id: p.org_id, role: 'org_admin' },
          p.id,
          'Projet modifié en administration',
          p.id,
        );
        log(s, p.org_id, `Projet modifié : ${p.id}`);
      });
      json(res, 200, { ok: true });
      return true;
    }
    if (route === 'audit' && method === 'GET') {
      json(
        res,
        200,
        all(
          "SELECT e.*,u.name actor_name,o.name org_name FROM security_events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN organizations o ON o.id=e.org_id WHERE e.action LIKE 'Plateforme · %' ORDER BY e.created_at DESC,e.rowid DESC LIMIT 200",
        ),
      );
      return true;
    }
    throw new HttpError(404, 'Action d’administration introuvable.');
  };
}
