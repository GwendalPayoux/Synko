import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
const directory = mkdtempSync(join(tmpdir(), 'synko-e2e-'));
const { server, db } = createApp({ directory, origin: 'http://127.0.0.1:3199' });
server.listen(3199, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      rmSync(directory, { recursive: true, force: true });
      process.exit(0);
    }),
  );
