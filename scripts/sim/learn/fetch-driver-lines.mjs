// Actions job (lapsim-learn.yml): racing line per driver in every series (owner 2026-11-15).
// F1: scripts/sim/driver-lines.mjs (TracingInsights speed traces, 2026 and 2025). Formula E and SRO GT3 laps: driver-laps-extra.mjs. Endurance: driver-lines-endurance.mjs (Al Kamel
// qualifying laps 2024-2026 of tobi/imsa_data + sector positions of tobi/track-atlas). Driver names of every source go through
// drivers.mjs (one id per person). Out (committed): scripts/sim/data/learn/driver-lines.json (derived table only).
import {execFileSync, spawn} from 'node:child_process';
import {readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {cpus} from 'node:os';
import {join} from 'node:path';
import {buildRegistry} from './drivers.mjs';

const C = '.cache', N = Math.max(1, cpus().length), git = (...a) => execFileSync('git', a, {stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28}).toString();
mkdirSync(join(C, 'ti'), {recursive: true}); mkdirSync(join(C, 'learn'), {recursive: true});
for (const y of ['2025', '2026']) if (!existsSync(join(C, 'ti', y))) git('clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', `https://github.com/TracingInsights/${y}`, join(C, 'ti', y));
const imsa = join(C, 'learn', 'imsa_data');
if (!existsSync(imsa)) {
  git('clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', 'https://github.com/tobi/imsa_data', imsa);
  const q = git('-c', 'core.quotepath=off', '-C', imsa, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(p => /^data\/(wec|imsa|elms|alms)\/(2024|2025|2026)\/.*(qualif|hyperpole).*-laps\.csv$/i.test(p) && !/race/i.test(p));
  git('-C', imsa, 'sparse-checkout', 'set', '--no-cone', ...q); git('-C', imsa, 'checkout', '-q', 'HEAD');
}
const atlas = join(C, 'learn', 'tracks.jsonl');
if (!existsSync(atlas)) execFileSync('curl', ['-sSf', '--max-time', '120', '-o', atlas, 'https://raw.githubusercontent.com/tobi/track-atlas/main/tracks.jsonl']);
const run = (args, env = {}) => new Promise(ok => { const p = spawn('node', args, {stdio: 'inherit', env: {...process.env, ...env}}); p.on('exit', ok); });
const OUT = join(C, 'driver-lines');
await Promise.all(Array.from({length: N}, (_, i) => run(['scripts/sim/driver-lines.mjs', '2026,2025'], {LAPSIM_DL_PART: `${i}/${N}`, LAPSIM_DL_OUT: OUT})));
const extra = join(C, 'learn', 'extra-laps.ndjson');
await run(['scripts/sim/learn/driver-laps-extra.mjs', extra]); // Formula E and SRO GT3 laps with their drivers
await Promise.all(Array.from({length: N}, (_, i) => run(['scripts/sim/learn/driver-lines-endurance.mjs', imsa, atlas, OUT, `${i}/${N}`], {LAPSIM_DL_EXTRA: extra})));
// merge, with one id per driver across series
const f1 = [], end = [];
for (const f of readdirSync(OUT)) { const j = JSON.parse(readFileSync(join(OUT, f), 'utf8')); (f.startsWith('dle-') ? end : f1).push(j); }
const names = [];
for (const t of f1) for (const [code, n] of Object.entries(t.names || {})) if (n) names.push({name: n, series: 'f1', code});
for (const t of end) for (const r of Object.values(t.drivers)) for (const a of r.aliases || [r.name]) names.push({name: a, series: r.series});
const R = buildRegistry(names), idOf = n => R.ids.get(n) || null;
const out = {generatedAt: new Date().toISOString(), sources: ['TracingInsights (F1 speed traces)', 'tobi/imsa_data (Al Kamel laps, MIT)', 'tobi/track-atlas (timing sector positions)'], f1: {}, endurance: {}, people: R.people, ambiguous: R.ambiguous};
for (const t of f1) ((out.f1[t.id] ||= {})[t.year] = {fieldW: t.fieldW, field: t.field, drivers: Object.fromEntries(Object.entries(t.drivers).map(([c, r]) => [c, {...r, id: idOf(t.names?.[c]), name: t.names?.[c] || c}]))});
for (const t of end) ((out.endurance[t.id] ||= {})[t.bucket] = {cuts: t.cuts, atlas: t.atlas, fieldW3: t.fieldW3, field: t.field, drivers: Object.fromEntries(Object.entries(t.drivers).map(([k, r]) => [idOf(r.name) || k, r]))});
mkdirSync('scripts/sim/data/learn', {recursive: true});
writeFileSync('scripts/sim/data/learn/driver-lines.json', JSON.stringify(out));
console.log(`F1 tracks ${f1.length}, endurance groups ${end.length}, people ${Object.keys(R.people).length}, ambiguous names ${R.ambiguous.length}`);
