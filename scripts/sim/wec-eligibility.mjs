// Freeze eligibility with production values before fitting any candidate.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {withGrip} from './calibrate-lib.mjs';
import {checkTiming, timingMapping, sectorTimes} from './wec-timing.mjs';

export const SHARE_LIMIT_PP = 3;
export const rowKey = (w, i) => JSON.stringify([w.cls, Number(w.year), w.track, w.event, i, w.laps[i].car]);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function eligibilityInputs(root = '.', cache = '.cache/lapsim') {
  const files = {wec: join(cache, 'wec.json'), geometry: 'worker/lapsim/tracks-data.js',
    production: 'worker/lapsim/calibration-data.js', mapping: 'scripts/sim/data/wec-timing-positions.json',
    transfer: 'worker/lapsim/transfer-grip-data.js', timing71: 'scripts/sim/data/t71-wec-extra.json'};
  return Object.fromEntries(Object.entries(files).map(([k, f]) => [k, sha256(readFileSync(resolve(root, f)))]));
}
export function shareCheck(simSectors, simLap, realSectors, realLap) {
  const simShares = simSectors.map(s => 100 * s / simLap), realShares = realSectors.map(s => 100 * s / realLap);
  const deltaPP = simShares.map((s, i) => s - realShares[i]);
  const maxAbsPP = Math.max(...deltaPP.map(Math.abs));
  return {simShares, realShares, deltaPP, maxAbsPP, pass: Number.isFinite(maxAbsPP) && maxAbsPP <= SHARE_LIMIT_PP + 1e-10};
}

export function buildEligibility({wec, tracks, production, mappings, inputs, simulate = simulateLap}) {
  const ownGrip = id => Object.keys(production.seasons).sort().reverse().map(y => production.seasons[y]?.tracks?.[id]?.grip).find(g => g != null);
  const sessions = wec.filter(w => tracks[w.track] && !w.weather?.rain && ownGrip(w.track) != null);
  const checks = [], excluded = new Map();
  const ratios = mappings.rows.map(m => ({track: m.track, year: m.year, officialLengthM: m.layoutLengthM,
    modelLengthM: tracks[m.track] ? tracks[m.track].ds * tracks[m.track].kappa.length : null})).map(r => ({...r,
      ratio: r.modelLengthM === null ? null : r.modelLengthM / r.officialLengthM}));
  for (const w of sessions) {
    const tr = tracks[w.track], l = w.laps[0], ref = production.series?.wec?.[w.cls]?.[w.year];
    const check = checkTiming(timingMapping(mappings, 'wec', w.track, w.year), tr, l?.lap, l?.sectors);
    let reason = check.sectorReason, share = null;
    if (!reason && (!ref?.car || !Number.isFinite(ref.tracks?.[w.track]?.grip))) reason = 'missing production reference';
    if (!reason) {
      const override = {...tr, sectors: check.sectorEnds};
      const result = simulate(withGrip(override, ref.tracks[w.track].grip), ref.car, conditionsFromWeather(w.weather || {}));
      share = shareCheck(sectorTimes(result, override), result.lapTime, l.sectors, l.lap);
      if (!share.pass) reason = 'production sector share differs by more than 3 pp';
    }
    checks.push({class: w.cls, year: w.year, track: w.track, reason, ...share});
    if (reason) excluded.set(`${w.track}/${w.year}`, reason);
  }
  // Conservative mapping check: a failing class excludes the whole track-year.
  const rows = {}, coverage = {};
  for (const w of sessions) {
    const group = `${w.cls}/${w.year}`;
    const c = coverage[group] ||= {class: w.cls, year: w.year, laps: 0, sectorTerms: 0, tracks: [], positionedTraps: 0};
    w.laps.forEach((l, i) => {
      const key = rowKey(w, i);
      if (key in rows) throw new Error(`Duplicate WEC row: ${key}`);
      const check = checkTiming(timingMapping(mappings, 'wec', w.track, w.year), tracks[w.track], l.lap, l.sectors);
      const reason = excluded.get(`${w.track}/${w.year}`) || check.sectorReason;
      rows[key] = {eligible: !reason, reason: reason || null};
      c.laps++; if (!reason) { c.sectorTerms++; if (!c.tracks.includes(w.track)) c.tracks.push(w.track); }
    });
  }
  return {schemaVersion: 1, method: 'Best dry lap per class-season, production car/grip/weather; any failing class excludes track-year',
    inputs, lengthTolerancePct: 2, shareLimitPP: SHARE_LIMIT_PP, sectorSumToleranceSec: 0.002,
    ratios, checks, excluded: Object.fromEntries(excluded), rows,
    coverage: Object.values(coverage).map(c => ({...c, heldOutTracksWithSectors: c.tracks.length}))};
}

export function verifyEligibility(table, inputs) {
  if (table?.schemaVersion !== 1 || table.lengthTolerancePct !== 2 || table.shareLimitPP !== 3 || table.sectorSumToleranceSec !== 0.002 || !table.rows)
    throw new Error('Invalid fixed WEC eligibility table');
  for (const [key, hash] of Object.entries(inputs)) if (table.inputs?.[key] !== hash)
    throw new Error(`Fixed WEC eligibility input mismatch: ${key}`);
  return table;
}

export function rowEligibility(table, session, index) {
  const row = table?.rows[rowKey(session, index)];
  if (!row || typeof row.eligible !== 'boolean') throw new Error(`Missing fixed WEC eligibility row: ${rowKey(session, index)}`);
  return row;
}
