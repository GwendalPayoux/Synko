import { spawn } from 'node:child_process';
const processes = [['server/index.mjs'], ['node_modules/vite/bin/vite.js']].map((args) =>
  spawn(process.execPath, args, { stdio: 'inherit' }),
);
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) child.kill();
}
for (const child of processes) {
  child.on('exit', (code) => stop(code ?? 0));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
