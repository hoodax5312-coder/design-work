import { spawn } from 'node:child_process';

const processes = [spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', '03-程序区/后端服务/index.ts'], { stdio: 'inherit' })];

let stopping = false;
const stopAll = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
};

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

for (const child of processes) {
  child.on('exit', (code) => {
    if (!stopping) {
      stopAll();
      process.exitCode = code || 1;
    }
  });
}
