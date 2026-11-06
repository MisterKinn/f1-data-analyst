#!/usr/bin/env node
// Claude Code hook for graphify (https://github.com/safishamsi/graphify).
// Works on Windows, Mac, Linux and Claude Code on the web. Never blocks a session:
// any failure (no Python, no network, no graph) exits 0 quietly.
//   refresh            install graphifyy if missing, then rebuild graphify-out/ (AST only, no API cost)
//   search|read|compact  pass the hook JSON to `graphify hook-guard <mode>` (adds a short graph hint)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] || 'refresh';
const root = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const pythons = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 90_000, shell: false, ...opts });

function findGraphify() {
  if (run('graphify', ['--help']).status === 0) return ['graphify', []];
  for (const py of pythons) if (run(py, ['-m', 'graphify', '--help']).status === 0) return [py, ['-m', 'graphify']];
  return null;
}

function install() {
  for (const py of pythons) {
    for (const extra of [['--user'], ['--user', '--break-system-packages'], ['--break-system-packages']]) {
      if (run(py, ['-m', 'pip', 'install', '-q', ...extra, 'graphifyy'], { timeout: 120_000 }).status === 0) return findGraphify();
    }
  }
  return null;
}

try {
  let g = findGraphify();
  if (mode === 'refresh') {
    g ??= install();
    if (!g) process.exit(0);
    const r = run(g[0], [...g[1], 'update', '.'], { timeout: 120_000 });
    if (r.status === 0) console.log('graphify: code graph refreshed (graphify-out/). Use `graphify query "<question>"` before grepping.');
  } else if (g) {
    let input = '';
    try { input = readFileSync(0, 'utf8'); } catch {}
    const r = run(g[0], [...g[1], 'hook-guard', mode], { input, timeout: 9_000 });
    if (r.status === 0 && r.stdout) process.stdout.write(r.stdout);
  }
} catch {}
process.exit(0);
