const { spawn } = require('node:child_process');

const isWindows = process.platform === 'win32';

const services = [
  ['app', '\x1b[36m', 'npm run dev:app'],
  ['worker', '\x1b[35m', 'npm run dev:worker'],
  ['admin', '\x1b[33m', 'npm run dev:admin'],
];

const reset = '\x1b[0m';
const children = new Map();
let shuttingDown = false;

function writePrefixed(name, color, chunk, stream) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line) stream.write(`${color}[${name}]${reset} ${line}\n`);
  }
}

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) {
    if (!child.killed) child.kill(signal);
  }
}

function commandFor(command) {
  if (isWindows) {
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', command],
    };
  }

  const [file, ...args] = command.split(' ');
  return { file, args };
}

for (const [name, color, command] of services) {
  const { file, args } = commandFor(command);
  const child = spawn(file, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.set(name, child);
  child.stdout.on('data', (chunk) => writePrefixed(name, color, chunk, process.stdout));
  child.stderr.on('data', (chunk) => writePrefixed(name, color, chunk, process.stderr));

  child.on('exit', (code, signal) => {
    children.delete(name);
    if (!shuttingDown && code !== 0) {
      console.error(`${color}[${name}]${reset} exited with ${signal || code}`);
      stopAll();
      process.exitCode = code || 1;
    }
  });
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
