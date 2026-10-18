import { createApp } from './app.mjs';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3100),
  host = process.env.HOST || '127.0.0.1';
const { server, db } = createApp({
  directory: resolve(process.env.DATA_DIR || 'data'),
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  secure: process.env.SECURE_COOKIES === 'true',
  registration: process.env.ALLOW_REGISTRATION !== 'false',
  mailMode:
    process.env.NODE_ENV === 'production' ? 'disabled' : process.env.MAIL_MODE || 'disabled',
});
server.listen(port, host, () => console.log(`Synko API : http://${host}:${port}`));
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
