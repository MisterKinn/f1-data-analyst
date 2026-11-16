// Pit loss and pit speed per F1 track, learned from the measured pit losses (task A5; owner rule: measured data is never changed).
//   node scripts/sim/pit-loss-fit.mjs   -> prints the table; writes scripts/sim/data/learn/pit-loss-fit.json
// Measured: worker/lapsim/race-data.js pitLoss = in-lap + out-lap − 2 × the driver's clean race lap (median per track, F1 races).
// Model: the car leaves the lap at the pit entry and rejoins at the pit exit (worker/lapsim/pit-lane-data.js, OpenStreetMap path).
// On the pit path it brakes from its lap speed at the entry (PIT_BRAKE_MS2) down to the limit, holds the limit, and accelerates back to its
// lap speed at the exit (PIT_ACCEL_MS2). Drive loss = pit path time − lap time from entry to exit. Measured loss = drive loss + C, where C
// (stop, box in and out, cold tyres on the out-lap) is one number for all tracks, fitted at 80 km/h (Sporting Regulations B1.6.3a).
// Result 2026-11-17: neither model beats the plain median of the other tracks (docs/lapsim-pit-lanes.md), so the site shows only the
// measured loss and the documented limit. Rerun when more measured pit losses or official pit-lane drawings exist.
// A track whose residual is closer to the 60 km/h drive loss is marked "60 km/h?" (a hint only; the limit must come from the RD notes).
import {writeFileSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {lapsimRace} from '../../worker/lapsim/race-data.js';
import {lapsimPitLanes} from '../../worker/lapsim/pit-lane-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimPitSpeed} from '../../worker/lapsim/pit-speed-data.js';

// Experiment only (not used by the site): the drive models A and B.
const PIT_BRAKE_MS2 = 20, PIT_ACCEL_MS2 = 9; // engineering estimates: braking into the limit, accelerating out of the lane

function pitSpeedKph(series, trackId) {
  const ev = lapsimPitSpeed.tracks?.[trackId]?.[series];
  return ev?.kph ?? lapsimPitSpeed.series[series]?.kph ?? null;
}

// v: racing-lap speed (m/s) every ds metres over a lap of len metres; pit: {entryS, exitS, lengthM}; limKph: pit speed limit
function pitDrive(v, ds, len, pit, limKph) {
  const lim = limKph / 3.6, n = v.length, at = s => v[Math.min(n - 1, Math.round(((s % len) + len) % len / ds))];
  const span = ((pit.exitS - pit.entryS) % len + len) % len; let track = 0;
  for (let s = 0; s < span; s += ds) track += ds / Math.max(at(pit.entryS + s), 1);
  const ve = Math.max(at(pit.entryS), lim), vx = Math.max(at(pit.exitS), lim), L = pit.lengthM;
  const dB = (ve * ve - lim * lim) / (2 * PIT_BRAKE_MS2), dA = (vx * vx - lim * lim) / (2 * PIT_ACCEL_MS2);
  const tB = (ve - lim) / PIT_BRAKE_MS2, tA = (vx - lim) / PIT_ACCEL_MS2;
  const lane = dB + dA <= L ? tB + tA + (L - dB - dA) / lim : tB + tA; // a very short lane has no constant-speed part
  return {lane, track, loss: lane - track};
}

// Variant B (declared 2026-11-17 06:00, before running): the OSM path includes the entry and exit roads, where the limit does not
// apply. Only a zone of zoneM metres in the middle of the path (the garages) is held to the limit; elsewhere the car drives the path
// as fast as its bends allow (PIT_LAT_MS2), braking and accelerating at the same rates, from the lap speed at the entry to the lap
// speed at the exit. zoneM is one number for all tracks, learned with C by scripts/sim/pit-loss-fit.mjs (leave one out).
const PIT_LAT_MS2 = 25;
function pitDriveZone(v, ds, len, pit, limKph, zoneM) {
  const lim = limKph / 3.6, n = v.length, at = s => v[Math.min(n - 1, Math.round(((s % len) + len) % len / ds))];
  const span = ((pit.exitS - pit.entryS) % len + len) % len; let track = 0;
  for (let s = 0; s < span; s += ds) track += ds / Math.max(at(pit.entryS + s), 1);
  const P = pit.pts, seg = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1])), cum = [0]; seg.forEach(d => cum.push(cum.at(-1) + d));
  const L = cum.at(-1), z0 = Math.max(0, (L - zoneM) / 2), z1 = Math.min(L, (L + zoneM) / 2), m = Math.max(2, Math.round(L / 4)), h = L / m;
  const pos = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]); return [P[i - 1][0] + f * (P[i][0] - P[i - 1][0]), P[i - 1][1] + f * (P[i][1] - P[i - 1][1])]; };
  const Q = Array.from({length: m + 1}, (_, k) => pos(k * h)), cap = Q.map((q, k) => {
    if (k * h >= z0 && k * h <= z1) return lim;
    const a = Q[Math.max(0, k - 3)], c = Q[Math.min(m, k + 3)], ab = Math.hypot(q[0] - a[0], q[1] - a[1]), bc = Math.hypot(c[0] - q[0], c[1] - q[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const cr = Math.abs((q[0] - a[0]) * (c[1] - a[1]) - (q[1] - a[1]) * (c[0] - a[0])), kap = ab * bc * ac > 1e-6 ? 2 * cr / (ab * bc * ac) : 0;
    return Math.min(90, kap > 1e-6 ? Math.sqrt(PIT_LAT_MS2 / kap) : 90); });
  const u = cap.slice(); u[0] = Math.min(u[0], at(pit.entryS)); u[m] = Math.min(u[m], at(pit.exitS));
  for (let k = 1; k <= m; k++) u[k] = Math.min(u[k], Math.sqrt(u[k - 1] ** 2 + 2 * PIT_ACCEL_MS2 * h));
  for (let k = m - 1; k >= 0; k--) u[k] = Math.min(u[k], Math.sqrt(u[k + 1] ** 2 + 2 * PIT_BRAKE_MS2 * h));
  let lane = 0; for (let k = 0; k < m; k++) lane += 2 * h / Math.max(0.5, u[k] + u[k + 1]);
  return {lane, track, loss: lane - track};
}


const K = lapsimKernel(), rows = [], ZONES = [200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000];
const ENV = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0});
// race-data keys named after an event, not the circuit (same-circuit duplicates such as styrian or 70th-anniversary are skipped)
const EVENT_TRACK = {french: 'paul-ricard-f1', russian: 'sochi', portuguese: 'portimao', eifel: 'nurburgring-gp', tuscan: 'mugello'};
for (const [key, r] of Object.entries(lapsimRace.tracks)) {
  const id = EVENT_TRACK[key] || key;
  const pit = lapsimPitLanes.tracks[id]; if (!pit || !(r.pitLoss > 0) || !T[id]) continue;
  const car = carsFor(id)['2025']?.car; if (!car) continue;
  const t = K.trackFromData(T[id]), res = K.simulateLap(t, car, ENV);
  const kph = pitSpeedKph('f1', id), drive = k => pitDrive(res.v, t.ds, T[id].length, pit, k).loss;
  rows.push({id, measured: r.pitLoss, kph, d: drive(kph), d80: drive(80), d60: drive(60), pitM: pit.lengthM, z: Object.fromEntries(ZONES.map(z => [z, pitDriveZone(res.v, t.ds, T[id].length, pit, kph, z).loss]))});
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
if (!rows.length) { console.log('no F1 track with both a pit lane and a measured pit loss'); process.exit(0); }
// C is fitted on the other tracks (leave one out) and the residual is reported on the track left out; the speed used is the
// documented one (pit-speed-data.js). "60 km/h?" flags a track whose left-out residual fits 60 km/h better: check the RD notes.
const C = median(rows.map(r => r.measured - r.d));
for (const r of rows) { const c = median(rows.filter(o => o !== r).map(o => o.measured - o.d)); r.res = r.measured - c - r.d;
  r.flag60 = r.kph !== 60 && Math.abs(r.measured - c - r.d60) < Math.abs(r.measured - c - r.d80); }
const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
console.log(`C (stop, box, out-lap tyres) = ${C.toFixed(2)} s from ${rows.length} F1 tracks; left-out residual rms ${rms(rows.map(r => r.res)).toFixed(2)} s, median |res| ${median(rows.map(r => Math.abs(r.res))).toFixed(2)} s`);
for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) console.log(r.id.padEnd(20), String(r.pitM).padStart(5), 'm  limit', r.kph, ' measured', r.measured.toFixed(1), ' drive', r.d.toFixed(1), ' (@60', r.d60.toFixed(1) + ')  left-out residual', r.res.toFixed(1), r.flag60 ? '  -> 60 km/h?' : '');
writeFileSync('scripts/sim/data/learn/pit-loss-fit.json', JSON.stringify({C, brakeMs2: PIT_BRAKE_MS2, accelMs2: PIT_ACCEL_MS2, rmsLeftOut: rms(rows.map(r => r.res)), rows}, null, 1) + '\n');

// Declared comparison (2026-11-17 06:00): baseline = median of the other tracks' measured loss (no model); A = whole path at the
// limit + C; B = limit zone of Z m + C (Z and C chosen on the other tracks). Pass: B's left-out rms below the baseline's.
const loo = pred => rms(rows.map(r => r.measured - pred(r, rows.filter(o => o !== r))));
const base = loo((r, O) => median(O.map(o => o.measured)));
const varA = loo((r, O) => median(O.map(o => o.measured - o.d)) + r.d);
const varB = loo((r, O) => { let best = null; for (const z of ZONES) { const c = median(O.map(o => o.measured - o.z[z])), e = rms(O.map(o => o.measured - c - o.z[z])); if (!best || e < best.e) best = {z, c, e}; } r.zPick = best.z; r.predB = best.c + r.z[best.z]; return r.predB; });
console.log(`left-out rms: baseline (median of others) ${base.toFixed(2)} s, A (whole path at limit) ${varA.toFixed(2)} s, B (limit zone) ${varB.toFixed(2)} s; zones picked ${[...new Set(rows.map(r => r.zPick))].join(', ')} m`);
const dd = rows.map(r => (r.measured - median(rows.filter(o => o !== r).map(o => o.measured))) ** 2 - (r.measured - r.predB) ** 2), mu = dd.reduce((a, b) => a + b, 0) / dd.length, se = Math.sqrt(dd.reduce((a, b) => a + (b - mu) ** 2, 0) / (dd.length - 1) / dd.length);
console.log(`B vs baseline, paired squared error: gain ${mu.toFixed(2)} ± ${se.toFixed(2)} s² (1 SE) -> ${mu > se ? 'B kept' : 'B rejected (within noise)'}`);
