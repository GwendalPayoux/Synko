import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { passwordHash } from '../server/security.mjs';
import { seedTemplates } from '../server/templates.mjs';
import { createApp } from '../server/app.mjs';
const directory = mkdtempSync(join(tmpdir(), 'synko-e2e-'));
const { server, db } = createApp({ directory, origin: 'http://127.0.0.1:3199' });
// Operator fixture exists only in the isolated, disposable E2E database.
const uid = randomUUID(),
  oid = randomUUID(),
  password = randomUUID() + '-E2E!',
  email = 'operator-' + randomUUID() + '@synko.test',
  stamp = new Date().toISOString();
db.prepare('INSERT INTO organizations(id,name,created_at) VALUES (?,?,?)').run(
  oid,
  'Synko E2E',
  stamp,
);
db.prepare(
  'INSERT INTO users(id,name,email,password_hash,platform_admin,created_at) VALUES (?,?,?,?,1,?)',
).run(uid, 'Opérateur E2E', email, await passwordHash(password), stamp);
db.prepare("INSERT INTO memberships(org_id,user_id,role) VALUES (?,?,'org_admin')").run(oid, uid);
seedTemplates((sql, ...args) => db.prepare(sql).run(...args), oid, uid);
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/e2e-operator.json', JSON.stringify({ email, password }));
server.listen(3199, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      rmSync(directory, { recursive: true, force: true });
      process.exit(0);
    }),
  );
