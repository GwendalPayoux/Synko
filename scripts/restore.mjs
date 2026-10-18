import { restoreBackup } from '../server/backups.mjs';
if (!process.argv[2] || !process.argv[3])
  throw new Error('Usage : node scripts/restore.mjs dossier-sauvegarde nouvelle-destination');
console.log(restoreBackup(process.argv[2], process.argv[3]));
