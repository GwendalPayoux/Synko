import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HttpError,
  password,
  passwordHash,
  passwordMatches,
  hash,
  token,
  email,
  text,
} from './security.mjs';
import { transaction } from './database.mjs';
const now = () => new Date().toISOString();
export function accountsModule({ db, one, all, run, payload, json, directory, origin, mailMode }) {
  const security = (s, action) =>
    run(
      'INSERT INTO security_events VALUES (?,?,?,?,?)',
      randomUUID(),
      s?.user_id || null,
      s?.org_id || null,
      action,
      now(),
    );
  function send(user, kind) {
    if (mailMode !== 'local')
      throw new HttpError(503, 'Le service d’envoi d’e-mails n’est pas configuré.');
    const secret = token(),
      id = randomUUID();
    transaction(db, () => {
      run(
        'UPDATE account_tokens SET used_at=? WHERE user_id=? AND kind=? AND used_at IS NULL',
        now(),
        user.id,
        kind,
      );
      run(
        'INSERT INTO account_tokens VALUES (?,?,?,?,?,?,?)',
        id,
        user.id,
        kind,
        hash(secret),
        Date.now() + (kind === 'reset' ? 30 : 1440) * 60000,
        null,
        now(),
      );
    });
    const outbox = join(directory, 'mail-outbox');
    mkdirSync(outbox, { recursive: true });
    writeFileSync(
      join(outbox, id + '.json'),
      JSON.stringify(
        {
          to: user.email,
          subject:
            kind === 'reset' ? 'Réinitialisation Synko' : 'Vérification de votre e-mail Synko',
          url: `${origin}/?${kind}=${secret}`,
          transport: 'local-development-only',
          created_at: now(),
        },
        null,
        2,
      ),
      { flag: 'wx', mode: 0o600 },
    );
  }
  return {
    security,
    async publicRoute(req, res, url) {
      const path = url.pathname;
      if (path === '/api/auth/capabilities' && req.method === 'GET') {
        json(res, 200, {
          password_reset: mailMode === 'local',
          email_verification: mailMode === 'local',
          mail_transport: mailMode,
        });
        return true;
      }
      if (path === '/api/auth/forgot' && req.method === 'POST') {
        if (mailMode !== 'local')
          throw new HttpError(503, 'Le service d’envoi d’e-mails n’est pas configuré.');
        const b = await payload(req),
          address = email(b.email),
          user = one('SELECT * FROM users WHERE email=?', address);
        if (user) send(user, 'reset');
        json(res, 200, {
          message:
            'Si ce compte existe, une instruction a été déposée dans la boîte d’envoi locale de développement. Aucun e-mail externe n’a été envoyé.',
        });
        return true;
      }
      if (['/api/auth/reset', '/api/auth/verify'].includes(path) && req.method === 'POST') {
        const b = await payload(req),
          kind = path.endsWith('reset') ? 'reset' : 'verify',
          v = one(
            'SELECT * FROM account_tokens WHERE token_hash=? AND kind=? AND used_at IS NULL AND expires_at>?',
            hash(text(b.token, 'Jeton', 128)),
            kind,
            Date.now(),
          );
        if (!v) throw new HttpError(422, 'Lien invalide, expiré ou déjà utilisé.');
        const encrypted = kind === 'reset' ? await passwordHash(password(b.password)) : null;
        transaction(db, () => {
          const current = one(
            'SELECT * FROM account_tokens WHERE id=? AND used_at IS NULL AND expires_at>?',
            v.id,
            Date.now(),
          );
          if (!current) throw new HttpError(422, 'Lien expiré ou déjà utilisé.');
          run('UPDATE account_tokens SET used_at=? WHERE id=?', now(), v.id);
          if (kind === 'reset') {
            run('UPDATE users SET password_hash=? WHERE id=?', encrypted, v.user_id);
            run('DELETE FROM sessions WHERE user_id=?', v.user_id);
          } else run('UPDATE users SET email_verified_at=? WHERE id=?', now(), v.user_id);
          security(
            { user_id: v.user_id },
            kind === 'reset' ? 'Mot de passe réinitialisé' : 'Adresse e-mail vérifiée',
          );
        });
        json(res, 200, { ok: true });
        return true;
      }
      return false;
    },
    async route(req, res, url, s) {
      const path = url.pathname,
        method = req.method;
      if (path === '/api/me/password' && method === 'POST') {
        const b = await payload(req),
          u = one('SELECT * FROM users WHERE id=?', s.user_id);
        if (
          !(await passwordMatches(
            text(b.current_password, 'Mot de passe actuel', 256),
            u.password_hash,
          ))
        )
          throw new HttpError(403, 'Mot de passe actuel incorrect.');
        const encrypted = await passwordHash(password(b.password));
        transaction(db, () => {
          run('UPDATE users SET password_hash=? WHERE id=?', encrypted, s.user_id);
          run('DELETE FROM sessions WHERE user_id=? AND id<>?', s.user_id, s.id);
          security(s, 'Mot de passe changé et autres sessions révoquées');
        });
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/me/verification' && method === 'POST') {
        send(one('SELECT * FROM users WHERE id=?', s.user_id), 'verify');
        json(res, 200, {
          message: 'Lien déposé dans data/mail-outbox. Aucun e-mail externe envoyé.',
        });
        return true;
      }
      if (path === '/api/me/export' && method === 'GET') {
        const tasks = all(
          'SELECT id,title,status,start_date,end_date FROM tasks WHERE org_id=? AND assignee_id=?',
          s.org_id,
          s.user_id,
        );
        const comments = all(
          'SELECT body,created_at FROM comments WHERE org_id=? AND author_id=?',
          s.org_id,
          s.user_id,
        );
        json(res, 200, {
          profile: { name: s.name, email: s.email, organization: s.org_name, role: s.role },
          tasks,
          comments,
        });
        return true;
      }
      return false;
    },
  };
}
