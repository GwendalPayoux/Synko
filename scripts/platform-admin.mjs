// Explicit operator bootstrap. Never grants privileges through a public HTTP route.
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDatabase, transaction } from '../server/database.mjs';
if (existsSync('.env')) process.loadEnvFile('.env');
const address = process.argv[2]?.toLowerCase();
if (!address) throw new Error('Usage : node scripts/platform-admin.mjs compte@entreprise.fr');
const db = openDatabase(resolve(process.env.DATA_DIR || 'data'));
try {
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(address);
  if (!user) throw new Error('Créez d’abord ce compte avec le parcours normal d’inscription.');
  transaction(db, () => {
    db.prepare('UPDATE users SET platform_admin=1 WHERE id=?').run(user.id);
    db.prepare('INSERT INTO security_events VALUES (?,?,NULL,?,?)').run(
      randomUUID(),
      user.id,
      'Droit opérateur plateforme accordé par CLI',
      new Date().toISOString(),
    );
  });
  console.log('Droit opérateur accordé. Reconnectez-vous pour afficher le registre plateforme.');
} finally {
  db.close();
}
