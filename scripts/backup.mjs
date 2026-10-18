import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createBackup } from '../server/backups.mjs';
if (existsSync('.env')) process.loadEnvFile('.env');
const source = resolve(process.env.DATA_DIR || 'data'),
  target = resolve(
    process.argv[2] || join(source, 'backups', new Date().toISOString().replace(/[:.]/g, '-')),
  );
console.log(await createBackup(source, target));
