// Builds simulator tracks from OpenF1 car positions (several drivers' best qualifying laps),
// with official corner positions (MultiViewer) and true-north alignment (f1-circuits GeoJSON).
// Also extracts real speed traces on the same distance scale for calibration.
// Reads .cache/lapsim (see fetch-openf1.mjs); writes worker/lapsim/tracks-data.js and
// .cache/lapsim/traces.json (not committed).
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {resampleClosed, projectOnto, kernelSmooth, headingCurvature, alignClosed, applyAlignment, lonLatToLocal} from '../../worker/lapsim/geometry.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const OUT = process.env.LAPSIM_TRACKS_OUT || 'worker/lapsim/tracks-data.js';
const DS = 5;
const SIGMA = Number(process.env.LAPSIM_SIGMA || 7), CURV_SMOOTH = Number(process.env.LAPSIM_CURV_SMOOTH || 12);
const index = JSON.parse(await readFile(join(CACHE, 'index.json'), 'utf8'));
const circuits = JSON.parse(await readFile(join(CACHE, 'circuits.json'), 'utf8').catch(() => '{}'));
const geo = JSON.parse(await readFile(join(CACHE, 'f1-circuits.geojson'), 'utf8').catch(() => 'null'));
const geometryYear = Math.max(...index.map(x => x.year));
const ms = d => Date.parse(d);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Points of one lap in metres, time order, inside the lap window. OpenF1 positions are 1/10 m.
function lapPoints(lap, scale = 10) {
  const t0 = ms(lap.lap.date_start), t1 = t0 + lap.lap.lap_duration * 1000;
  const pts = lap.location.map(r => ({t: ms(r[0]), x: r[1] / scale, y: r[2] / scale, z: r[3] / scale}))
    .filter(p => p.t >= t0 - 300 && p.t <= t1 + 300 && Number.isFinite(p.x) && !(p.x === 0 && p.y === 0)).sort((a, b) => a.t - b.t);
  const dedup = [];
  for (const p of pts) { const q = dedup[dedup.length - 1]; if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.5) dedup.push(p); }
  return {t0, t1, pts: dedup};
}

// Unwrap projected s along a lap that starts at the timing line
function unwrapS(sArr, L) {
  const out = Array.from(sArr); let off = 0;
  for (let i = 1; i < out.length; i++) { const d = sArr[i] - sArr[i - 1]; if (d < -L / 2) off += L; if (d > L / 2) off -= L; out[i] = sArr[i] + off; }
  return out;
}
function interpAt(ts, vs, t) {
  if (t <= ts[0]) return vs[0];
  for (let i = 1; i < ts.length; i++) if (ts[i] >= t) { const f = (t - ts[i - 1]) / (ts[i] - ts[i - 1] || 1); return vs[i - 1] + (vs[i] - vs[i - 1]) * f; }
  return vs[vs.length - 1];
}

function buildCurve(laps) {
  const pole = lapPoints(laps[0]);
  const inLap = pole.pts.filter(p => p.t >= pole.t0 && p.t < pole.t1); // no overlap at the seam
  let ref = resampleClosed(inLap.map(p => p.x), inLap.map(p => p.y), 4);
  const lapsPts = laps.map(l => lapPoints(l)).filter(l => l.pts.length > 50);
  let curve;
  for (let iter = 0; iter < 3; iter++) {
    const S = [], X = [], Y = [], Z = [];
    for (const l of lapsPts) {
      const pr = projectOnto(ref, l.pts.map(p => p.x), l.pts.map(p => p.y));
      l.pts.forEach((p, k) => { S.push(pr.s[k]); X.push(p.x); Y.push(p.y); Z.push(p.z); });
    }
    const L = ref.length;
    const sig = iter === 0 ? 12 : SIGMA;
    const sx = kernelSmooth(S, X, L, sig, 2), sy = kernelSmooth(S, Y, L, sig, 2), sz = kernelSmooth(S, Z, L, 30, 2);
    curve = resampleClosed(sx.values, sy.values, 2, sz.values);
    ref = curve;
  }
  // rotate so that s = 0 is the timing line (pole lap start position)
  const pp = lapPoints(laps[0]);
  const pr = projectOnto(curve, pp.pts.map(p => p.x), pp.pts.map(p => p.y));
  const s0 = interpAt(pp.pts.map(p => p.t), unwrapS(pr.s, curve.length), pp.t0);
  const shift = Math.round((((s0 % curve.length) + curve.length) % curve.length) / curve.ds);
  const rot = a => Float64Array.from({length: a.length}, (_, i) => a[(i + shift) % a.length]);
  return {x: rot(curve.x), y: rot(curve.y), z: rot(curve.z), ds: curve.ds, length: curve.length, lapsUsed: lapsPts.length, points: lapsPts.reduce((a, l) => a + l.pts.length, 0)};
}

function geoFor(session) {
  if (!geo?.features) return null;
  const want = [session.location, session.circuit, session.country].map(slug);
  let best = null;
  for (const f of geo.features) {
    const p = f.properties || {}, hay = [p.Location, p.Name, p.id].map(slug).join(' ');
    const score = want.reduce((a, w) => a + (w && hay.includes(w) ? w.length : 0), 0);
    if (score && (!best || score > best.score)) best = {score, f};
  }
  return best?.f || null;
}

const tracks = {}, traces = [], buildCurveCache = {};
const report = [];
for (const entry of index.filter(x => x.year === geometryYear)) {
  const session = JSON.parse(await readFile(join(CACHE, 'sessions', entry.file), 'utf8'));
  const laps = session.laps.filter(l => l.location?.length > 50);
  if (laps.length < 3) { report.push(`${entry.circuit}: not enough laps with positions`); continue; }
  const c = buildCurve(laps);
  const grid = resampleClosed(c.x, c.y, DS, c.z);
  const {heading, kappa} = headingCurvature(grid.x, grid.y, grid.ds, CURV_SMOOTH);
  const n = grid.x.length, grade = new Float64Array(n);
  for (let i = 0; i < n; i++) grade[i] = Math.atan((grid.z[(i + 1) % n] - grid.z[(i - 1 + n) % n]) / (2 * grid.ds));
  // corners (official numbering) projected onto the line
  const info = circuits[entry.circuit_key];
  const corners = (info?.corners || []).map(k => {
    const pr = projectOnto(grid, [k.trackPosition.x / 10], [k.trackPosition.y / 10]);
    return {number: k.number, letter: k.letter || '', s: Math.round(pr.s[0])};
  }).sort((a, b) => a.s - b.s);
  // sector boundaries from the pole lap's sector times
  const pole = laps[0], pp = lapPoints(pole), pr = projectOnto(grid, pp.pts.map(p => p.x), pp.pts.map(p => p.y));
  const sUn = unwrapS(pr.s, grid.length), ts = pp.pts.map(p => p.t);
  const sAt = t => ((interpAt(ts, sUn, t) - interpAt(ts, sUn, pp.t0)) % grid.length + grid.length) % grid.length;
  const s1 = pole.lap.duration_sector_1, s2 = pole.lap.duration_sector_2;
  const sectors = Number.isFinite(s1) && Number.isFinite(s2) ? [Math.round(sAt(pp.t0 + s1 * 1000)), Math.round(sAt(pp.t0 + (s1 + s2) * 1000))] : null;
  // true north from the GeoJSON outline
  let headingTrue = null, align = null, map = null;
  const gf = geoFor(session);
  if (gf?.geometry?.coordinates?.length > 20) {
    const coords = gf.geometry.type === 'MultiLineString' ? gf.geometry.coordinates.flat() : gf.geometry.coordinates;
    const loc = lonLatToLocal(coords);
    align = alignClosed(Array.from(grid.x), Array.from(grid.y), loc.x, loc.y);
    if (align.rms < 60) headingTrue = Array.from(heading, h => align.mirror ? Math.PI - h + align.theta : h + align.theta);
    const ct = Math.cos(align.theta), st = Math.sin(align.theta);
    const step = Math.max(1, Math.floor(n / 360));
    map = {x: [], y: []};
    for (let i = 0; i < n; i += step) { const px = (align.mirror ? -1 : 1) * grid.x[i], py = grid.y[i]; map.x.push(Math.round(ct * px - st * py)); map.y.push(Math.round(st * px + ct * py)); }
  }
  const id = slug(session.circuit);
  tracks[id] = {
    id, name: session.location, circuit: session.circuit, circuitKey: entry.circuit_key, year: geometryYear, sessionKey: session.session_key,
    ds: grid.ds, length: Math.round(grid.length), sectors, corners,
    kappa: Array.from(kappa, v => Math.round(v * 1e5)), grade: Array.from(grade, v => Math.round(v * 1e4)),
    heading: headingTrue ? headingTrue.map(v => Math.round(v * 1e3)) : null,
    map, quality: {laps: c.lapsUsed, points: c.points, alignRms: align ? Math.round(align.rms) : null, mirror: align?.mirror ?? null},
    sources: ['OpenF1 car positions (qualifying)', info ? 'MultiViewer circuit corners' : null, gf ? 'bacinger/f1-circuits (MIT)' : null].filter(Boolean),
  };
  report.push(`${id}: ${Math.round(grid.length)} m, ${c.lapsUsed} laps, ${corners.length} corners, align ${align ? Math.round(align.rms) + ' m' : 'none'}`);
}

// OpenF1 car data sometimes freezes: speed, gear and rpm repeat and throttle reads 104 (outside 0-100).
// Those samples are dropped; distance comes from positions, so the rest of the lap stays usable.
function frozenRows(rows) {
  const bad = rows.map(r => r.thr > 100);
  for (let i = 0; i < rows.length;) {
    let j = i + 1;
    while (j < rows.length && rows[j].v === rows[i].v && rows[j].gear === rows[i].gear && rows[j].rpm === rows[i].rpm) j++;
    if (j - i >= 4) for (let k = i + 1; k < j; k++) bad[k] = true;
    i = j;
  }
  return bad;
}

// Real speed traces for calibration (every year), on the matching track's distance scale
for (const entry of index) {
  const session = JSON.parse(await readFile(join(CACHE, 'sessions', entry.file), 'utf8'));
  const track = tracks[slug(session.circuit)];
  if (!track) continue;
  const grid = (() => { // rebuild the raw-frame line used for projection
    const sameYear = index.find(x => x.year === geometryYear && slug(x.circuit) === track.id);
    return sameYear ? sameYear : null;
  })();
  if (!grid) continue;
  for (const lap of session.laps.filter(l => l.carData?.length > 50 && l.location?.length > 50)) {
    const pp = lapPoints(lap);
    const t0 = pp.t0, t1 = pp.t1;
    // align this lap's path to the geometry-year path, then measure distance by projection
    const geoSession = JSON.parse(await readFile(join(CACHE, 'sessions', grid.file), 'utf8'));
    const base = buildCurveCache[track.id] ||= buildCurve(geoSession.laps.filter(l => l.location?.length > 50));
    const ref = resampleClosed(base.x, base.y, 2);
    let px = pp.pts.map(p => p.x), py = pp.pts.map(p => p.y);
    let pr = projectOnto(ref, px, py);
    let meanLat = pr.lat.reduce((a, v) => a + Math.abs(v), 0) / pr.lat.length;
    if (meanLat > 8) { // different coordinate frame (other season): align the path first
      const al = alignClosed(px, py, Array.from(ref.x), Array.from(ref.y));
      ({x: px, y: py} = applyAlignment(al, px, py));
      pr = projectOnto(ref, px, py);
      meanLat = pr.lat.reduce((a, v) => a + Math.abs(v), 0) / pr.lat.length;
    }
    if (meanLat > 8) { report.push(`${session.year} ${track.id} ${lap.driver_number}: path does not match geometry (${meanLat.toFixed(0)} m)`); continue; }
    const sUn = unwrapS(pr.s, ref.length), ts = pp.pts.map(p => p.t), sStart = interpAt(ts, sUn, t0);
    const all = lap.carData.map(r => ({t: ms(r[0]), v: r[1], thr: r[2], brk: r[3], gear: r[4], rpm: r[5]})).filter(r => r.t >= t0 && r.t <= t1);
    const bad = frozenRows(all), rows = all.filter((_, k) => !bad[k]);
    if (rows.length < 0.85 * all.length) { report.push(`${session.year} ${track.id} ${lap.driver_number}: car data frozen for ${Math.round(100 - 100 * rows.length / all.length)}% of the lap; skipped`); continue; }
    const w = session.weather.filter(r => ms(r[0]) >= t0 - 15 * 60e3 && ms(r[0]) <= t0 + 2 * 60e3);
    const mean = k => w.length ? w.reduce((a, r) => a + (r[k] ?? 0), 0) / w.length : null;
    const we = w.reduce((a, r) => a + (r[6] || 0) * Math.sin((r[7] || 0) * Math.PI / 180), 0), wn = w.reduce((a, r) => a + (r[6] || 0) * Math.cos((r[7] || 0) * Math.PI / 180), 0);
    traces.push({
      year: session.year, track: track.id, session_key: session.session_key, driver_number: lap.driver_number, position: lap.position,
      lap_seconds: lap.lap.lap_duration, sectors: [lap.lap.duration_sector_1, lap.lap.duration_sector_2, lap.lap.duration_sector_3],
      s: rows.map(r => Math.round(((interpAt(ts, sUn, r.t) - sStart) % ref.length + ref.length) % ref.length * 10) / 10),
      v: rows.map(r => r.v), throttle: rows.map(r => r.thr), brake: rows.map(r => r.brk),
      weather: {airTempC: mean(1), trackTempC: mean(2), humidityPct: mean(3), pressureHpa: mean(4), rain: w.some(r => r[5] > 0),
        windSpeed: w.length ? Math.hypot(we, wn) / w.length : null, windFromDeg: w.length ? (Math.atan2(we, wn) * 180 / Math.PI + 360) % 360 : null},
    });
  }
}

await writeFile(OUT, `// Generated by scripts/sim/build-geometry.mjs from OpenF1 car positions (qualifying), MultiViewer\n// corner positions and bacinger/f1-circuits (MIT). Integers: kappa ×1e5 (1/m), grade ×1e4 (rad),\n// heading ×1e3 (rad, east = 0, counter-clockwise). Do not edit by hand.\nexport const lapsimTracks=${JSON.stringify(tracks)};\n`);
await writeFile(join(CACHE, 'traces.json'), JSON.stringify(traces));
console.log(report.join('\n'));
console.log(`tracks ${Object.keys(tracks).length}, traces ${traces.length}`);
