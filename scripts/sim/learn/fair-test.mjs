// Fair held-out test of two training-table sets on the SAME test rows (central decision 2026-11-24, WEC fair test):
// shipped = the tables at <commit> (what endurance-fit.json was learned from), refit = the tables in the working tree.
// Test rows = working-tree rows. Both sides: slow sessions recomputed by slowSessions() (fit-endurance.mjs), then leave one event
// out: fit on the training set without that event, predict that event's test rows. Score = RMS of the class-best lap error per
// event (as endurance-fit.json eventOutClass), per group, with event-bootstrap 90 % intervals (fixed seed) and the paired ratio.
//   node scripts/sim/learn/fair-test.mjs <shipped-commit> [out.json]     (default out: probe-out/fair-test.json)
// Needs the commit in the local history (git show). Slow: about 15-20 min on one core.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fit, loadRows, slowSessions, SOURCES} from './fit-endurance.mjs';

export const SEED = 20261124, BOOT = 2000;
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rms = e => Math.sqrt(e.reduce((a, x) => a + x * x, 0) / e.length) * 100, q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// per-event class-best errors of each prediction set: [{event, group, real, a, b}] with a / b the class-best predictions
export function eventErrors(rows, predA, predB) {
  const g = new Map(); rows.forEach((r, i) => { const k = r.eventKey + '|' + r.group, o = g.get(k) || g.set(k, {event: r.eventKey, group: r.group, real: Infinity, a: Infinity, b: Infinity}).get(k);
    o.real = Math.min(o.real, r.real); o.a = Math.min(o.a, predA[i]); o.b = Math.min(o.b, predB[i]); });
  return [...g.values()].map(o => ({...o, ea: o.a / o.real - 1, eb: o.b / o.real - 1}));
}
// RMS per side with event-bootstrap 90 % intervals; ratio = b / a on the same resampled events
export function score(ev, seed = SEED, n = BOOT) {
  const r = rng(seed), A = [], B = [], R = [];
  for (let i = 0; i < n; i++) { const s = ev.map(() => ev[Math.floor(r() * ev.length)]), a = rms(s.map(x => x.ea)), b = rms(s.map(x => x.eb)); A.push(a); B.push(b); R.push(b / a); }
  const a = rms(ev.map(x => x.ea)), b = rms(ev.map(x => x.eb)), f = v => +v.toFixed(3);
  return {events: ev.length, shipped: f(a), shippedPI90: [f(q(A, 0.05)), f(q(A, 0.95))], refit: f(b), refitPI90: [f(q(B, 0.05)), f(q(B, 0.95))], ratio: f(b / a), ratioPI90: [f(q(R, 0.05)), f(q(R, 0.95))]};
}

if (process.argv[1]?.endsWith('fair-test.mjs')) {
  const [ref, OUT = 'probe-out/fair-test.json'] = process.argv.slice(2); if (!ref) throw Error('usage: fair-test.mjs <shipped-commit> [out.json]');
  const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex'), TMP = '.cache/fair-test/' + ref;
  const oldFiles = SOURCES.map(f => { const p = join(TMP, f); mkdirSync(dirname(p), {recursive: true}); writeFileSync(p, execFileSync('git', ['show', `${ref}:${f}`], {maxBuffer: 1 << 28})); return p; });
  const tOld = loadRows(oldFiles).rows, tNew = loadRows(SOURCES).rows;
  const sOld = slowSessions(tOld), sNew = slowSessions(tNew), old = sOld.rows, test = sNew.rows;
  const loo = train => { const p = new Array(test.length); for (const ev of new Set(test.map(r => r.eventKey))) { const f = fit(train.filter(r => r.eventKey !== ev)); test.forEach((r, i) => { if (r.eventKey === ev) p[i] = f.predict(r); }); } return p; };
  const ev = eventErrors(test, loo(old), loo(test)), by = k => Object.fromEntries([...new Set(ev.map(k))].sort().map(g => [g, score(ev.filter(e => k(e) === g))]));
  const res = {generated: new Date().toISOString(), code: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), shippedTables: ref, seed: SEED, boot: BOOT, node: process.version,
    inputs: {shipped: Object.fromEntries(SOURCES.map((f, i) => [f, sha(oldFiles[i])])), refit: Object.fromEntries(SOURCES.map(f => [f, sha(f)]))},
    rows: {shippedTrain: old.length, test: test.length}, slowSessions: {shipped: sOld.slow, refit: sNew.slow},
    byGroup: by(e => e.group), wec: by(e => e.group + ' ' + e.event.split('|')[0]), events: ev.map(e => ({event: e.event, group: e.group, real: e.real, shipped: +(100 * e.ea).toFixed(3), refit: +(100 * e.eb).toFixed(3)}))};
  mkdirSync(dirname(OUT), {recursive: true}); writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.table(Object.fromEntries(Object.entries(res.byGroup).map(([g, s]) => [g, {events: s.events, shipped: s.shipped, refit: s.refit, ratio: s.ratio, ratioPI90: s.ratioPI90.join(' to ')}])));
}
