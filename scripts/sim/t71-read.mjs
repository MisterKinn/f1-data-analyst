// Timing71 replay reader: walk every frame of a replay ZIP and return one row per completed lap.
// Frame format (timing71/common replay.js): key frames `<unix>.json` (full state) and diff frames
// `<unix>i.json` ({cars, session} as dictdiffer diffs, messages, highlight). Rows in `cars` follow
// manifest.colSpec; times are `value` or `[value, flag]` (flags sb/pb/old). Data use: calibration only.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// dictdiffer patch, as in timing71/common diffs.js (add / change / remove on a dotted or array path).
const node = (o, path, parent, addKey) => {
  const all = path === '' ? [] : Array.isArray(path) ? [...path] : String(path).split('.');
  const keys = parent ? all.slice(0, -1) : all;
  const next = [...all.slice(keys.length), addKey]; // key used after the walk (to pick [] or {})
  keys.forEach((k, i) => {
    const after = i + 1 < keys.length ? keys[i + 1] : next[0];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(String(after)) ? [] : {};
    o = o[k];
  });
  return o;
};
export function patch(diff, target) {
  const dest = structuredClone(target);
  for (const [op, path, ch] of diff) {
    if (op === 'add') { const o = node(dest, path, false, ch[0]?.[0]); for (const [k, v] of ch) o[k] = v; }
    else if (op === 'remove') { const o = node(dest, path); for (const [k] of ch) delete o[k]; }
    else if (op === 'change') { const keys = Array.isArray(path) ? path : String(path).split('.'); node(dest, path, true)[keys.at(-1)] = ch[1]; }
  }
  return dest;
}

const val = v => Array.isArray(v) ? v[0] : v;
const num = v => { v = val(v); return v === '' || v == null || Number.isNaN(+v) ? null : +v; };

// Frames in time order: [{t, state}] built from key frames + diff frames.
export function* frames(dir) {
  const names = readdirSync(dir).map(n => n.match(/^(\d{5,11})(i?)\.json$/)).filter(Boolean)
    .map(m => ({t: +m[1], i: !!m[2], f: m[0]})).sort((a, b) => a.t - b.t || a.i - b.i);
  let state = null;
  for (const n of names) {
    const j = JSON.parse(readFileSync(join(dir, n.f), 'utf8'));
    if (!n.i) state = j;
    else if (state) state = {...state, cars: patch(j.cars || [], state.cars || []), session: patch(j.session || [], state.session || {})};
    else continue;
    yield {t: n.t, state};
  }
}

// Read a replay ZIP (Buffer path) → {manifest, cols, laps, weather, final}.
export function readReplay(zipPath) {
  const dir = mkdtempSync(join(tmpdir(), 't71-'));
  try {
    execFileSync('unzip', ['-qq', '-o', zipPath, '-d', dir]);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const names = manifest.colSpec.map(c => Array.isArray(c) ? c[0] : c);
    const col = n => names.indexOf(n);
    const C = {num: col('Num'), cls: col('Class'), laps: col('Laps'), last: col('Last'), best: col('Best'),
      s: names.map((n, i) => /^S\d+$/.test(n) ? i : -1).filter(i => i >= 0), tyre: col('T'), age: col('TA'), vft: col('VFT'), spd: col('Spd'), driver: col('Driver'), state: col('State')};
    const prev = new Map(); const laps = []; const weather = []; let final = null; let lastW = '';
    for (const {t, state} of frames(dir)) {
      final = state;
      const td = state.session?.trackData ?? state.trackData;
      if (td && JSON.stringify(td) !== lastW) { lastW = JSON.stringify(td); weather.push({t, v: td}); }
      for (const row of Object.values(state.cars || {})) {
        if (!Array.isArray(row)) continue; // rows removed by a diff leave holes
        const car = String(val(row[C.num]));
        const last = num(row[C.last]); const p = prev.get(car);
        // No Laps column (some ALMS/VLN feeds): count a lap each time Last changes.
        const n = C.laps >= 0 ? num(row[C.laps]) : p && last != null && last !== p.last ? p.n + 1 : (p?.n ?? 0);
        prev.set(car, {n, last});
        if (!p || n == null || p.n == null || n <= p.n || last == null) continue;
        laps.push({car, lap: n, t, time: last, s: C.s.map(i => i < 0 ? null : num(row[i])),
          tyre: C.tyre < 0 ? null : row[C.tyre], age: C.age < 0 ? null : val(row[C.age]),
          vft: C.vft < 0 ? null : val(row[C.vft]), spd: C.spd < 0 ? null : num(row[C.spd]),
          cls: C.cls < 0 ? null : val(row[C.cls]), driver: C.driver < 0 ? null : val(row[C.driver]),
          flag: state.session?.flagState ?? null, pit: /pit/i.test(String(val(row[C.state])))});
      }
    }
    const best = Object.fromEntries(Object.values(final?.cars || {}).filter(Array.isArray).map(r => [String(val(r[C.num])), num(r[C.best])]));
    const endFlag = final?.session?.flagState ?? null; // 'chequered' when the recording reached the end of the session
    return {endFlag, manifest: {colSpec: names, trackDataSpec: manifest.trackDataSpec, name: manifest.name, description: manifest.description}, laps, weather, best};
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

// Checks against the analysis JSON (lap list with flags) and the final Best column.
export function checkReplay(rep, analysis) {
  const ref = new Map();
  for (const [car, c] of Object.entries(analysis?.cars?.cars || {}))
    for (const st of c.stints || []) for (const l of st.laps || []) ref.set(`${car}:${l.lapNumber}`, l);
  // Lap numbering may differ by one between the frames' Laps counter and the analysis lapNumber: pick the offset with most equal times.
  const eq = off => rep.laps.filter(l => { const r = ref.get(`${l.car}:${l.lap + off}`); return r && Math.abs(r.laptime - l.time) < 0.0015; }).length;
  const offset = [0, 1, -1].reduce((b, o) => eq(o) > eq(b) ? o : b, 0);
  let matched = 0, equal = 0, sumOk = 0, sumN = 0;
  for (const l of rep.laps) {
    const r = ref.get(`${l.car}:${l.lap + offset}`);
    if (r) { matched++; if (Math.abs(r.laptime - l.time) < 0.0015) equal++; l.aflag = r.flag; }
    if (l.s.length && l.s.every(x => x != null)) { sumN++; if (Math.abs(l.s.reduce((a, b) => a + b, 0) - l.time) <= 0.002) sumOk++; }
  }
  const bestOk = Object.entries(rep.best).filter(([car, b]) => b != null).map(([car, b]) => {
    const ts = rep.laps.filter(l => l.car === car).map(l => l.time); return ts.length ? Math.abs(Math.min(...ts) - b) < 0.0015 : null;
  }).filter(x => x != null);
  return {offset, framesLaps: rep.laps.length, analysisLaps: ref.size, matched, timeEqual: equal, sectorSumOk: sumOk, sectorRows: sumN,
    bestEqual: bestOk.filter(Boolean).length, bestCars: bestOk.length};
}
