const { rmSync } = require('node:fs');
const { resolve } = require('node:path');

const targets = [
  resolve(__dirname, '..', 'admin-dashboard', '.next'),
  resolve(__dirname, '..', 'admin-dashboard', 'node_modules', '.cache', 'next'),
];
const root = resolve(__dirname, '..');

for (const target of targets) {
  if (!target.startsWith(root)) {
    throw new Error(`Refusing to delete outside workspace: ${target}`);
  }

  rmSync(target, { recursive: true, force: true });
}

console.log('Cleared admin-dashboard Next caches');
