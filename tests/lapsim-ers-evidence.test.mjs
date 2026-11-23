import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PRE, lstsq, fitLaw, regenZones, signFlipP} from '../scripts/sim/ers-evidence.mjs';

const E = JSON.parse(gunzipSync(readFileSync(new URL('../scripts/sim/data/learn/ers-evidence.json.gz', import.meta.url))).toString('utf8'));

// step 10a (claude/gate-ers-law-prereg-2026-11-23.md): the evidence file has every pre-registered part and nothing changed after the run
test('ERS evidence file shape', () => {
  assert.equal(E.prereg, 'claude/gate-ers-law-prereg-2026-11-23.md');
  for (const k of ['mass', 'meFactor', 'cRoll', 'vLo', 'vHi', 'vRef', 'win', 'thr', 'dPkernel', 'minSlopeKW100', 'clipX']) assert.ok(Math.abs(E.pre[k] - PRE[k]) <= 0.05 + 1e-3 * Math.abs(PRE[k]), k);
  assert.deepEqual(E.pre.regenTracks, PRE.regenTracks);
  const rows = E.deploy.rows.filter(r => !r.skipped);
  assert.ok(rows.length >= 40, 'track-seasons with samples');
  for (const r of rows) {
    assert.ok([2023, 2024, 2025].includes(r.year) && r.n >= 100 && r.nBelowCut > 0, r.track);
    for (const k of ['P0kW', 'slopeKWper100', 'stepKW', 'cdA']) assert.ok(Number.isFinite(r[k]), `${r.year} ${r.track} ${k}`);
    assert.ok(r.cdA > 0.8 && r.cdA < 2.5, `${r.year} ${r.track} CdA ${r.cdA}`);
  }
  for (const k of ['stepKW', 'slopeKWper100', 'P0kW']) { const p = E.deploy.pooled[k]; assert.ok(p.n >= 15 && p.ci90[0] <= p.mean && p.mean <= p.ci90[1], k); }
  assert.ok(['a kernel cut-off', 'b flat', 'c taper'].includes(E.deploy.decision.winner));
  assert.ok(E.clipping.cannotShow.includes('Straight Mode state'));
  assert.ok(new Set(E.clipping.rows.map(r => r.track)).size >= 15);
  for (const c of E.clipping.rows) assert.ok(c.clipShare >= 0 && c.clipShare <= 1 && c.laps >= 5, c.track);
  assert.deepEqual(E.regen.map(r => r.track), PRE.regenTracks);
});

// regen identity (conservation): what the MGU-K recovers cannot exceed the work of the braking force, and that work is the kinetic-energy
// drop minus what drag and rolling resistance took
test('regen identity: regen ≤ ΔKE − drag − roll work, per braking zone', () => {
  for (const r of E.regen) assert.ok(r.kernel.identity.regenLeBrakeWork && r.kernel.identity.brakeWorkLeDKE, r.track);
  // synthetic stop from 300 km/h at 4 g, drag at 1.3 m² × 1.2 kg/m³
  const dt = 0.05, t = [], v = []; for (let i = 0, x = 300 / 3.6; x > 20; i++, x -= 4 * 9.81 * dt) { t.push(i * dt); v.push(x); }
  t.push(t.length * dt); v.push(v.at(-1) + 5); // accelerate again: closes the zone
  const o = {m: 776, me: 776 * 1.06, rhoCdA: 1.56, share: 0.4, eta: 0.9, cap: 350e3};
  const [z] = regenZones(t, v, v.map(() => true), o);
  assert.equal(z.negSteps, 0);
  assert.ok(Math.abs(z.wBrake - (z.dKEe - z.wDrag - z.wRoll)) < 1e-6 * z.dKEe, 'brake work closes the zone energy');
  assert.ok(z.regenBF <= o.eta * o.share * z.wBrake + 1e-6);
  // no cap: the two laws differ exactly by η·share·(drag + roll work)
  const [u] = regenZones(t, v, v.map(() => true), {...o, cap: Infinity, me: o.m});
  assert.ok(u.regenBF < u.regenKE && Math.abs(u.regenKE - u.regenBF - o.eta * o.share * (u.wDrag + u.wRoll)) < 1e-6 * u.regenKE);
});

test('power-law fit recovers a known wheel power, with and without a cut-off step', () => {
  const S = [], vc = 280 / 3.6;
  for (let k = 0; k < 400; k++) { const v = (180 + 160 * k / 400) / 3.6, open = k % 3 === 0, c = open ? 0.9 : 1.4;
    for (const step of [0, PRE.dPkernel]) S.push({v, open, y: 550e3 + (v < vc ? step : 0) - c * v ** 3 / 2, set: step}); }
  const flat = fitLaw(S.filter(s => !s.set), 'step', vc), cut = fitLaw(S.filter(s => s.set), 'step', vc);
  assert.ok(Math.abs(flat[0] - 550e3) < 1 && Math.abs(flat[3]) < 1 && Math.abs(flat[1] - 1.4) < 1e-6 && Math.abs(flat[2] - 0.9) < 1e-6);
  assert.ok(Math.abs(cut[3] - PRE.dPkernel) < 1);
  assert.deepEqual(lstsq([[1, 0], [0, 1], [1, 1]], [1, 2, 3]).map(x => +x.toFixed(9)), [1, 2]);
  assert.equal(signFlipP([1, 1, 1, 1, 1]), 1 / 32);
});
