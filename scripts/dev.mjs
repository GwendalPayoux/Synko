import { spawn } from 'node:child_process';
const processes = [['server/index.mjs'], ['node_modules/vite/bin/vite.js']].map((args) =>
  spawn(process.execPath, args, { stdio: 'inherit' }),
);
for (const p of processes)
  p.on('exit', (code) => {
    for (const other of processes) other.kill();
    process.exitCode = code ?? 0;
  });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => processes.forEach((p) => p.kill()));
