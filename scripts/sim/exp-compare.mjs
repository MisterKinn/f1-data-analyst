// Compare calibration variants on the same held-out rows with the gate (gate.mjs).
// Rows: F1 holdout laps per season (track left out, factor from the other season) and WEC holdout laps per
// class/season (track left out of the WEC fit, F1 track factor). node scripts/sim/exp-compare.mjs base.js cand.js [...]
import {pathToFileURL} from 'node:url';
import {gate} from './gate.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export function heldOut(c) {
  const rows = {};
  const add = (g, s) => { const real = Object.fromEntries(Object.entries(s.tracks || {}).map(([id, t]) => [id, t.realLap]));
    for (const r of s.holdout?.tracks || []) if (real[r.track] > 0) rows[`${g}|${r.track}`] = r.errorSec / real[r.track] * 100; };
  for (const [y, s] of Object.entries(c.seasons || {})) add(`f1/${y}`, s);
  for (const [cls, ys] of Object.entries(c.series?.wec || {})) for (const [y, s] of Object.entries(ys)) add(`wec-${cls}/${y}`, s);
  return rows;
}
export function compare(base, cand) {
  const a = heldOut(base), b = heldOut(cand), keys = Object.keys(a).filter(k => k in b);
  const by = {all: keys, f1: keys.filter(k => k.startsWith('f1')), wec: keys.filter(k => k.startsWith('wec'))};
  for (const k of keys) (by[k.split('|')[0]] ||= []).push(k);
  return Object.fromEntries(Object.entries(by).map(([g, ks]) => { const r = gate(ks.map(k => a[k]), ks.map(k => b[k]));
    return [g, {n: r.n, base: +r.rmsCur.toFixed(3), cand: +r.rmsNew.toFixed(3), reason: r.reason}]; }));
}
if (process.argv[1]?.endsWith('exp-compare.mjs')) {
  const load = async f => (await import(pathToFileURL(f).href)).lapsimCalibration;
  if (process.argv[2] === '--physics') {
    // Reporting switch only: no model flag or calibration run.
    const files = process.argv.slice(3);
    if (files.length < 4 || files.length % 2) throw new Error('Usage: exp-compare.mjs --physics base.js validate-base.json cand.js validate-cand.json [...]');
    const {physicalDiagnostics, comparePhysical, BOUND_TOLERANCE} = await import('./exp-physics.mjs');
    const variants = [], calibrations = [];
    const sha256 = f => createHash('sha256').update(readFileSync(f)).digest('hex');
    for (let i = 0; i < files.length; i += 2) {
      const calibration = await load(files[i]), validation = JSON.parse(readFileSync(files[i + 1], 'utf8'));
      calibrations.push(calibration);
      variants.push({calibration: files[i], validation: files[i + 1],
        sha256: {calibration: sha256(files[i]), validation: sha256(files[i + 1])},
        physical: physicalDiagnostics(calibration, validation)});
    }
    console.log(JSON.stringify({schemaVersion: 1, baseline: variants[0].calibration,
      boundTolerance: BOUND_TOLERANCE, variants,
      comparisons: variants.slice(1).map((v, i) => ({candidate: v.calibration,
        heldOut: compare(calibrations[0], calibrations[i + 1]),
        physical: comparePhysical(variants[0].physical, v.physical)}))}, null, 2));
  } else {
  const base = await load(process.argv[2]);
  for (const f of process.argv.slice(3)) { console.log('==', f); for (const [g, r] of Object.entries(compare(base, await load(f)))) console.log(g.padEnd(16), JSON.stringify(r)); }
  }
}
