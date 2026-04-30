import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['--no-warnings', 'server/index.js'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
  }),
];

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
