import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {erskKnots, taperOf, REV1} from '../worker/lapsim/event-energy.js';
import {energyLimit} from '../worker/lapsim/energy-limits.js';
import {eventFor} from '../worker/lapsim/names.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
import {simulate} from '../worker/lapsim/tool.js';

const K = lapsimKernel(), kw = (kph, ot, knots) => K.erskLimitW('f1-2026', kph / 3.6, 350e3, ot, knots) / 1000;
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} vs ${b}`);
// FIA Power Unit Information rows that apply to the session (step 22 collector output)
const PU = (() => { const [h, ...rows] = readFileSync(new URL('../scripts/sim/data/fia-docs/f1-2026-power-unit-information.csv', import.meta.url), 'utf8').replace(/^﻿/, '').trim().split('\n')
  .map(l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; });
  return rows.map(r => Object.fromEntries(h.map((k, i) => [k, r[i]]))).filter(r => r.applies_to_session === '1'); })();
const idOf = ev => Object.keys(lapsimAllTracks).find(id => eventFor(id, 2026) === ev);

test('Base taper (C5.2.8): 350 kW to 290 km/h, 100 kW at 340, 0 at 345', () => {
  for (const [v, p] of [[200, 350], [290, 350], [315, 225], [340, 100], [342.5, 50], [345, 0], [360, 0]]) near(kw(v, false), p, 'base ' + v);
});
test('Overtake taper (C5.2.8 ii): 350 kW to 337.5 km/h, 0 at 355', () => {
  for (const [v, p] of [[300, 350], [337.5, 350], [346.25, 175], [355, 0], [370, 0]]) near(kw(v, true), p, 'ot ' + v);
});
test('Rev 1 taper (printed): 350 kW to 200 km/h, 0 at 300, both modes', () => {
  const k = {std: REV1, ot: REV1};
  for (const [v, p] of [[120, 350], [200, 350], [250, 175], [300, 0], [320, 0]]) { near(kw(v, false, k), p, 'rev1 ' + v); near(kw(v, true, k), p, 'rev1 ot ' + v); }
});
test('flag off by default; on: Rev 1 only at Monaco and Singapore 2026', () => {
  assert.equal(erskKnots('monte-carlo', 2026), undefined);
  assert.deepEqual(erskKnots('monte-carlo', 2026, true), {std: REV1, ot: REV1});
  assert.deepEqual(erskKnots('singapore', 2026, true), {std: REV1, ot: REV1});
  assert.equal(erskKnots('monza', 2026, true), undefined);
  assert.equal(erskKnots('monte-carlo', 2025, true), undefined);
});
test('taper per event matches the FIA documents (qualifying curve), Rev 1 printed breakpoints match', () => {
  const q = PU.filter(r => r.session === 'Q' && r.item === 'ERS-K DC power curve');
  assert.ok(q.length >= 20);
  for (const r of q) { const id = idOf(r.event); if (!id) continue; assert.equal(taperOf(id, 2026), /^Rev 1/.test(r.curve) ? 'rev1' : 'base', r.event); }
  const std = PU.filter(r => r.curve === 'Rev 1 - Standard');
  assert.ok(std.length >= 2);
  for (const r of std) assert.deepEqual(JSON.parse(r.knots_kmh_kw), REV1, r.event);
});
test('qualifying recharge limit: one event per level equals the FIA document', () => {
  const byLevel = new Map();
  for (const r of PU) if (r.session === 'Q' && r.item === 'recharge' && r.lap_scope === 'ordinary lap' && idOf(r.event) && !byLevel.has(+r.value)) byLevel.set(+r.value, idOf(r.event));
  assert.deepEqual([...byLevel.keys()].sort((a, b) => a - b), [5, 6, 6.5, 7, 7.5, 8, 8.5, 9]);
  for (const [mj, id] of byLevel) assert.equal(energyLimit(id, 2026).mj, mj, id);
});
test('flag on: Monaco 2026 qualifying lap is slower with Rev 1; flag off unchanged', () => {
  const off = simulate({track: 'monte-carlo', car: '2026'}).result.lap_seconds;
  process.env.LAPSIM_EVENT_ENERGY = 'on';
  try { const on = simulate({track: 'monte-carlo', car: '2026'}).result.lap_seconds; assert.ok(on > off, `${on} > ${off}`);
    assert.equal(simulate({track: 'monza', car: '2026'}).result.lap_seconds, (delete process.env.LAPSIM_EVENT_ENERGY, simulate({track: 'monza', car: '2026'}).result.lap_seconds)); }
  finally { delete process.env.LAPSIM_EVENT_ENERGY; }
  assert.equal(simulate({track: 'monte-carlo', car: '2026'}).result.lap_seconds, off);
});
