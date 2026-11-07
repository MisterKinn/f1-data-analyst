// Race-pace model: lap time over a race from a predicted pole lap.
//   lap(n) = pole × raceRatio + slope × (n − 1) + offset[compound] + wear[compound] × tyreAge (+ pit loss on stop laps)
// slope = fuel burn and track rubbering together (s/lap, usually negative); raceRatio = clean race pace on a
// fresh medium tyre with full fuel relative to the pole lap (race energy limits, fuel load, tyre management).
// Factors are fitted per race from OpenF1 race laps (scripts/sim/race-pace.mjs) and pooled per track.

export const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'];

// Solve A x = b (small dense system, partial pivoting); null when singular
export function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// Ridge least squares: rows of {x: feature array, y}; lambda per feature (0 = free)
export function ridge(rows, lambda) {
  const p = rows[0].x.length, A = Array.from({length: p}, () => Array(p).fill(0)), b = Array(p).fill(0);
  for (const {x, y, w = 1} of rows) for (let i = 0; i < p; i++) { if (!x[i]) continue; b[i] += w * x[i] * y; for (let j = 0; j < p; j++) A[i][j] += w * x[i] * x[j]; }
  for (let i = 0; i < p; i++) A[i][i] += lambda[i] ?? 0;
  return solve(A, b);
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };

// Clean racing laps of one race: dry, green-flag, not lap 1, not in/out laps, within 107% of the
// driver's median. `race` is the compact file from fetch-openf1.mjs.
export function cleanLaps(race) {
  const col = Object.fromEntries(race.columns.map((c, i) => [c, i]));
  const neutral = new Set();
  let scFrom = null;
  for (const [, lap, cat, flag, msg] of race.control || []) {
    const m = String(msg || '').toUpperCase();
    if (lap == null) continue;
    if (/SAFETY CAR DEPLOYED|VSC DEPLOYED|VIRTUAL SAFETY CAR DEPLOYED/.test(m) || flag === 'RED') scFrom ??= lap;
    if (scFrom != null && (/IN THIS LAP|ENDING|RESUME|GREEN/.test(m) || flag === 'GREEN' || flag === 'CLEAR')) { for (let l = scFrom; l <= lap + 1; l++) neutral.add(l); scFrom = null; }
    if (flag === 'DOUBLE YELLOW' || (cat === 'Flag' && flag === 'YELLOW' && /TRACK/.test(m))) neutral.add(lap);
  }
  if (scFrom != null) for (let l = scFrom; l <= scFrom + 60; l++) neutral.add(l);
  // intermediate/wet-tyre laps are already left out; only a mostly wet race is skipped
  const wx = race.weather || [], wet = wx.length > 0 && wx.filter(w => w[5] > 0).length / wx.length > 0.3;
  const pitLaps = new Set((race.pits || []).map(([d, l]) => d + ':' + l));
  const out = [];
  for (const [num, d] of Object.entries(race.drivers || {})) {
    const ok = d.laps.filter(l => Number.isFinite(l[col.time]) && l[col.lap] > 1 && !l[col.pitOut] && !pitLaps.has(num + ':' + l[col.lap])
      && !neutral.has(l[col.lap]) && COMPOUNDS.includes(l[col.compound]) && Number.isFinite(l[col.tyreAge]));
    const med = median(ok.map(l => l[col.time]));
    for (const l of ok) if (l[col.time] < med * 1.07) out.push({driver: num, team: d.team, lap: l[col.lap], time: l[col.time], compound: l[col.compound], age: l[col.tyreAge], stint: l[col.stint]});
  }
  // race length: last lap number of the winner (array length can include duplicate rows)
  const ds = Object.values(race.drivers || {}), win = ds.find(d => d.position === 1) || ds[0];
  const totalLaps = win ? Math.max(0, ...win.laps.map(l => l[col.lap]).filter(Number.isFinite)) : 0;
  return {laps: out, wet, totalLaps};
}

// One race: driver intercepts + lap slope + compound offsets (vs MEDIUM) + wear per compound
export function fitRace(laps, {lambdaWear = 50, lambdaOffset = 5} = {}) {
  const drivers = [...new Set(laps.map(l => l.driver))];
  if (laps.length < 40 || drivers.length < 4) return null;
  const nD = drivers.length, iSlope = nD, iOff = {SOFT: nD + 1, HARD: nD + 2}, iWear = {SOFT: nD + 3, MEDIUM: nD + 4, HARD: nD + 5};
  const rows = laps.map(l => {
    const x = Array(nD + 6).fill(0);
    x[drivers.indexOf(l.driver)] = 1; x[iSlope] = l.lap - 1;
    if (iOff[l.compound] != null) x[iOff[l.compound]] = 1;
    x[iWear[l.compound]] = l.age;
    return {x, y: l.time};
  });
  const used = c => laps.some(l => l.compound === c);
  const lambda = [...Array(nD).fill(0), 0, used('SOFT') ? lambdaOffset : 1e6, used('HARD') ? lambdaOffset : 1e6,
    ...['SOFT', 'MEDIUM', 'HARD'].map(c => used(c) ? lambdaWear : 1e6)];
  const x = ridge(rows, lambda);
  if (!x) return null;
  const pred = rows.map(r => r.x.reduce((s, v, i) => s + v * x[i], 0));
  const resid = rows.map((r, i) => r.y - pred[i]);
  // reference pace: best driver intercept, i.e. the leading car on a fresh medium at lap 1 fuel
  const ref = Math.min(...x.slice(0, nD));
  return {
    ref, slope: x[iSlope], n: laps.length,
    offset: {SOFT: used('SOFT') ? x[iOff.SOFT] : null, MEDIUM: 0, HARD: used('HARD') ? x[iOff.HARD] : null},
    wear: Object.fromEntries(COMPOUNDS.map(c => [c, used(c) ? x[iWear[c]] : null])),
    rmsSec: Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / resid.length),
  };
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

// Pool fits of one track over seasons (newer seasons weigh more) into one parameter set
export function poolTrack(fits) {
  const w = fits.map((f, i) => 1 + i), W = (get) => { const v = fits.map((f, i) => [get(f), w[i]]).filter(([x]) => Number.isFinite(x)); return v.length ? v.reduce((s, [x, k]) => s + x * k, 0) / v.reduce((s, [, k]) => s + k, 0) : null; };
  return {
    slope: W(f => f.slope), raceRatio: W(f => f.raceRatio), pitLoss: W(f => f.pitLoss), laps: fits.at(-1)?.laps ?? null,
    offset: Object.fromEntries(COMPOUNDS.map(c => [c, W(f => f.offset[c])])),
    wear: Object.fromEntries(COMPOUNDS.map(c => [c, W(f => f.wear[c])])),
    seasons: fits.map(f => f.year),
  };
}

// Lap-by-lap race for one strategy: stints [{compound, laps}], pole = predicted pole lap (s)
export function raceLaps(track, pole, stints, {startAge = 0} = {}) {
  const fill = (v, d) => Number.isFinite(v) ? v : d;
  const out = [];
  let n = 1;
  for (const [k, s] of stints.entries()) {
    for (let a = 0; a < s.laps; a++, n++) {
      const age = (k === 0 ? startAge : 0) + a;
      let t = pole * track.raceRatio + track.slope * (n - 1) + fill(track.offset[s.compound], 0) + Math.max(0, fill(track.wear[s.compound], 0.05)) * age;
      if (a === 0 && k > 0) t += track.pitLoss ?? 22;
      out.push({lap: n, time: t, compound: s.compound, age});
    }
  }
  return out;
}

// Best one- and two-stop strategies (two different dry compounds required), searched over pit laps
export function strategies(track, pole, total = track.laps) {
  const res = [];
  const pairs = [];
  for (const a of COMPOUNDS) for (const b of COMPOUNDS) if (a !== b) pairs.push([a, b]);
  for (const [a, b] of pairs) {
    let best = null;
    for (let p = 8; p <= total - 8; p++) { const L = raceLaps(track, pole, [{compound: a, laps: p}, {compound: b, laps: total - p}]); const T = L.reduce((s, l) => s + l.time, 0); if (!best || T < best.total) best = {stops: 1, stints: [[a, p], [b, total - p]], total: T}; }
    res.push(best);
  }
  for (const a of COMPOUNDS) for (const b of COMPOUNDS) for (const c of COMPOUNDS) {
    if (new Set([a, b, c]).size < 2) continue;
    let best = null;
    for (let p = 6; p <= total - 12; p += 1) for (let q = p + 6; q <= total - 6; q += 1) {
      const L = raceLaps(track, pole, [{compound: a, laps: p}, {compound: b, laps: q - p}, {compound: c, laps: total - q}]);
      const T = L.reduce((s, l) => s + l.time, 0); if (!best || T < best.total) best = {stops: 2, stints: [[a, p], [b, q - p], [c, total - q]], total: T};
    }
    res.push(best);
  }
  return res.filter(Boolean).sort((x, y) => x.total - y.total);
}
