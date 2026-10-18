import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function createBackup(source, target) {
  source = resolve(source);
  target = resolve(target);
  if (existsSync(target))
    throw new Error('La destination existe déjà. Choisissez un nouveau dossier.');
  mkdirSync(target, { recursive: true });
  const live = new DatabaseSync(join(source, 'synko.sqlite'), { readOnly: true });
  try {
    await backup(live, join(target, 'synko.sqlite'));
  } finally {
    live.close();
  }
  const snapshot = new DatabaseSync(join(target, 'synko.sqlite'), { readOnly: true });
  let versions;
  try {
    if (snapshot.prepare('PRAGMA quick_check').get().quick_check !== 'ok')
      throw new Error('La copie SQLite est invalide.');
    versions = snapshot.prepare('SELECT storage_key,sha256 FROM document_versions').all();
  } finally {
    snapshot.close();
  }
  mkdirSync(join(target, 'files'));
  for (const v of versions) {
    if (!/^[a-f0-9-]+$/.test(v.storage_key)) throw new Error('Clé de stockage invalide.');
    const bytes = readFileSync(join(source, 'files', v.storage_key));
    if (sha(bytes) !== v.sha256) throw new Error('Intégrité documentaire invalide.');
    writeFileSync(join(target, 'files', v.storage_key), bytes, { flag: 'wx' });
  }
  const manifest = {
    format: 1,
    created_at: new Date().toISOString(),
    database_sha256: sha(readFileSync(join(target, 'synko.sqlite'))),
    files: versions,
  };
  writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  return { path: target, files: versions.length };
}
export function restoreBackup(source, target) {
  source = resolve(source);
  target = resolve(target);
  if (existsSync(target))
    throw new Error(
      'La restauration exige une destination inexistante. Aucune donnée ne sera écrasée.',
    );
  const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')),
    database = readFileSync(join(source, 'synko.sqlite'));
  if (manifest.format !== 1 || sha(database) !== manifest.database_sha256)
    throw new Error('Sauvegarde invalide ou base altérée.');
  for (const f of manifest.files) {
    if (
      !/^[a-f0-9-]+$/.test(f.storage_key) ||
      sha(readFileSync(join(source, 'files', f.storage_key))) !== f.sha256
    )
      throw new Error('Fichier de sauvegarde altéré.');
  }
  mkdirSync(target, { recursive: true });
  mkdirSync(join(target, 'files'));
  writeFileSync(join(target, 'synko.sqlite'), database, { flag: 'wx' });
  for (const f of manifest.files)
    writeFileSync(
      join(target, 'files', f.storage_key),
      readFileSync(join(source, 'files', f.storage_key)),
      { flag: 'wx' },
    );
  const check = new DatabaseSync(join(target, 'synko.sqlite'), { readOnly: true });
  try {
    if (
      check.prepare('PRAGMA quick_check').get().quick_check !== 'ok' ||
      check.prepare('PRAGMA foreign_key_check').all().length
    )
      throw new Error('Échec du contrôle après restauration.');
  } finally {
    check.close();
  }
  return { path: target, files: manifest.files.length };
}
