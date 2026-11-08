// Racing lines for the /simulation map.
// Finding behind the method: public F1 car positions (F1 timing → FastF1/OpenF1/TracingInsights) are
// snapped to one reference path per track (the sideways gap between two drivers' laps is ~0.05 m), so
// they show where the track is, not which line a car took. The line is therefore predicted:
//  - track edges: TUM racetrack-database (centre line + measured widths, LGPL-3.0) where the track is in
//    it; otherwise the timing reference path ± an assumed half-width (labelled);
//  - racing line: minimum-curvature line inside the edges (worker/lapsim/racing-line.js), checked against
//    TUM's own published minimum-curvature line;
//  - speed, brake and throttle along the line: the real pole lap (TracingInsights car data).
// All in the frame of the track map (worker/lapsim/tracks-data.js), by a rigid fit.
// Writes worker/lapsim/racing-lines-data.js and docs/lapsim-racing-lines.md.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {minCurvatureLine} from '../../worker/lapsim/racing-line.js';
import {tiTrack} from './ti-races.mjs';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim', STEP = 8, MAX_FIT = 5, CAR_HALF = 1.0, ASSUMED_HALF = 6;
// lap-sim track id → TUM racetrack-database file
const TUM = {austin: 'Austin', hungaroring: 'Budapest', catalunya: 'Catalunya', melbourne: 'Melbourne', 'mexico-city': 'MexicoCity', montreal: 'Montreal',
  monza: 'Monza', sakhir: 'Sakhir', interlagos: 'SaoPaulo', shanghai: 'Shanghai', silverstone: 'Silverstone', 'spa-francorchamps': 'Spa', spielberg: 'Spielberg',
  suzuka: 'Suzuka', 'yas-marina-circuit': 'YasMarina', zandvoort: 'Zandvoort'};
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.round(q * (s.length - 1)))]; };
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

function clone(url, dir, noCheckout) {
  if (existsSync(join(dir, '.git'))) return;
  execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', ...(noCheckout ? ['--no-checkout'] : []), url, dir], {env: {...process.env, GIT_LFS_SKIP_SMUDGE: '1'}});
}
const csv = t => t.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split(',').map(Number));

function resample(x, y, step) {
  const s = [0]; for (let i = 1; i <= x.length; i++) s.push(s[i - 1] + Math.hypot(x[i % x.length] - x[i - 1], y[i % x.length] - y[i - 1]));
  const L = s.at(-1), n = Math.round(L / step), X = [], Y = [];
  for (let k = 0, j = 0; k < n; k++) { const t = k * L / n; while (s[j + 1] < t) j++; const f = (t - s[j]) / (s[j + 1] - s[j] || 1), b = (j + 1) % x.length; X.push(x[j] + f * (x[b] - x[j])); Y.push(y[j] + f * (y[b] - y[j])); }
  return {x: X, y: Y};
}
const normals = (x, y) => x.map((_, i) => { const n = x.length, dx = x[(i + 1) % n] - x[(i - 1 + n) % n], dy = y[(i + 1) % n] - y[(i - 1 + n) % n], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
const nearest = (bx, by, px, py) => { let bi = 0, bd = Infinity; for (let j = 0; j < bx.length; j++) { const d = (bx[j] - px) ** 2 + (by[j] - py) ** 2; if (d < bd) { bd = d; bi = j; } } return [bi, Math.sqrt(bd)]; };

// rigid fit (rotation, optional mirror, shift; no scale: both in metres) of path A onto path B by ICP
function fitRigid(ax, ay, bx, by) {
  const ca = [mean(ax), mean(ay)], cb = [mean(bx), mean(by)];
  let best = {err: Infinity};
  for (const m of [1, -1]) for (let r = 0; r < 12; r++) {
    let th = r * Math.PI / 6, tx = cb[0], ty = cb[1], err = Infinity;
    const put = (x, y) => { const u = m * (x - ca[0]), v = y - ca[1]; return [Math.cos(th) * u - Math.sin(th) * v + tx, Math.sin(th) * u + Math.cos(th) * v + ty]; };
    for (let it = 0; it < 25; it++) {
      const Q = ax.map((x, i) => { const [px, py] = put(x, ay[i]), [j, d] = nearest(bx, by, px, py); return [bx[j], by[j], d]; });
      err = Math.sqrt(mean(Q.map(q => q[2] ** 2)));
      const U = ax.map((x, i) => [m * (x - ca[0]), ay[i] - ca[1]]), mu = [mean(U.map(p => p[0])), mean(U.map(p => p[1]))], mq = [mean(Q.map(q => q[0])), mean(Q.map(q => q[1]))];
      let sxx = 0, sxy = 0; U.forEach((p, i) => { const a = p[0] - mu[0], b = p[1] - mu[1], c = Q[i][0] - mq[0], d = Q[i][1] - mq[1]; sxx += a * c + b * d; sxy += a * d - b * c; });
      th = Math.atan2(sxy, sxx); tx = mq[0] - (Math.cos(th) * mu[0] - Math.sin(th) * mu[1]); ty = mq[1] - (Math.sin(th) * mu[0] + Math.cos(th) * mu[1]);
    }
    if (err < best.err) best = {err, put};
  }
  return best;
}

// real pole lap car data (speed/brake/throttle by distance) from TracingInsights, latest dry season
const TI = join(CACHE, 'ti-tel');
async function poleCarData(id, years) {
  for (const year of years) {
    const dir = join(TI, 'repo-' + year);
    try { await mkdir(TI, {recursive: true}); clone(`https://github.com/TracingInsights/${year}`, dir, true); } catch { continue; }
    const tree = execFileSync('git', ['-C', dir, 'ls-tree', '-r', '--name-only', 'HEAD'], {maxBuffer: 1 << 28}).toString().split('\n');
    const event = [...new Set(tree.filter(p => /Grand Prix\/Qualifying\/[A-Z]{3}\/laptimes\.json$/.test(p)).map(p => p.split('/')[0]))].find(e => tiTrack(e, year) === id);
    if (!event) continue;
    const get = async p => {
      const f = join(TI, String(year), p); if (existsSync(f)) return JSON.parse(await readFile(f, 'utf8'));
      const r = await fetch(`https://raw.githubusercontent.com/TracingInsights/${year}/main/${p.split('/').map(encodeURIComponent).join('/')}`); if (!r.ok) return null;
      const t = await r.text(); await mkdir(join(f, '..'), {recursive: true}); await writeFile(f, t); return JSON.parse(t);
    };
    let best = null, rain = false;
    for (const d of tree.filter(p => p.startsWith(event + '/Qualifying/') && p.endsWith('/laptimes.json')).map(p => p.split('/')[2])) {
      const L = await get(`${event}/Qualifying/${d}/laptimes.json`); if (!L) continue;
      if (L.wR?.some(r => r === true)) rain = true;
      L.lap.forEach((lap, i) => { const t = L.time[i]; if (Number.isFinite(t) && L.del?.[i] !== true && (!best || t < best.time)) best = {d, lap, time: t}; });
    }
    if (rain || !best) continue;
    const T = await get(`${event}/Qualifying/${best.d}/${best.lap}_tel.json`), tel = T?.tel || T;
    if (tel?.distance?.length > 100) return {year, ...best, tel};
  }
  return null;
}

const rt = join(CACHE, 'racetrack-database');
await mkdir(CACHE, {recursive: true});
clone('https://github.com/TUMFTM/racetrack-database', rt, false);
const out = {generatedAt: new Date().toISOString(), source: 'Edges: TUM racetrack-database (LGPL-3.0). Car data: TracingInsights.', tracks: {}};
const report = ['# Racing lines', '', `Generated ${out.generatedAt}.`, '',
  "Public F1 car positions are snapped to one reference path per track (two drivers' laps differ by ~0.05 m sideways), so a measured racing line does not exist in public data. The line is predicted (minimum curvature inside the track edges); speed, brake and throttle along it are the real pole lap.", '',
  '| Track | Edges | Edge fit to timing path (m) | Timing path inside edges | Width median (m) | Predicted vs TUM optimal line, mean / 95% (m) | Pole lap |', '|---|---|---|---|---|---|---|'];
const years = (process.env.LAPSIM_LINE_YEARS || '2026,2025').split(',').map(Number), only = process.env.LAPSIM_LINE_TRACKS?.split(',');
const tumGaps = [];
for (const [id, td] of Object.entries(lapsimTracks)) {
  if (!td.map?.x?.length || (only && !only.includes(id))) continue;
  const ref = resample(td.map.x, td.map.y, STEP), nrm = normals(ref.x, ref.y);
  let left, right, edges = 'assumed', fitM = null, inside = null, cross = null;
  const tum = TUM[id] && existsSync(join(rt, 'tracks', TUM[id] + '.csv')) ? csv(await readFile(join(rt, 'tracks', TUM[id] + '.csv'), 'utf8')) : null;
  if (tum) {
    const fit = fitRigid(tum.map(r => r[0]), tum.map(r => r[1]), ref.x, ref.y), C = tum.map(r => fit.put(r[0], r[1]));
    const cx = C.map(c => c[0]), cy = C.map(c => c[1]);
    // TUM edges as offsets along the timing path's normal; TUM widths are to the right/left of its direction
    left = []; right = [];
    ref.x.forEach((x, i) => {
      const [j] = nearest(cx, cy, x, ref.y[i]), j2 = (j + 1) % C.length, tx = cx[j2] - cx[j], ty = cy[j2] - cy[j];
      const same = tx * -nrm[i][1] + ty * nrm[i][0] >= 0; // TUM runs the same way as the timing path
      // layout changed since TUM's survey (fit worse than MAX_FIT m): keep TUM's widths, centred on the timing path
      const off = fit.err > MAX_FIT ? 0 : (cx[j] - x) * nrm[i][0] + (cy[j] - ref.y[i]) * nrm[i][1], wl = same ? tum[j][3] : tum[j][2], wr = same ? tum[j][2] : tum[j][3];
      left.push(off + wl); right.push(off - wr);
    });
    fitM = Math.round(fit.err * 10) / 10; edges = fit.err > MAX_FIT ? 'TUM-widths' : 'TUM';
    inside = Math.round(left.filter((l, i) => l >= 0 && right[i] <= 0).length / left.length * 1000) / 10;
    const rl = csv(await readFile(join(rt, 'racelines', TUM[id] + '.csv'), 'utf8')).map(r => fit.put(r[0], r[1]));
    cross = {x: rl.map(p => p[0]), y: rl.map(p => p[1])};
  } else { left = ref.x.map(() => ASSUMED_HALF); right = ref.x.map(() => -ASSUMED_HALF); }
  // predicted line: minimum curvature inside the edges, starting from the corridor midline
  const mid = left.map((l, i) => (l + right[i]) / 2), half = left.map((l, i) => Math.max(0.3, (l - right[i]) / 2 - CAR_HALF));
  const pred = minCurvatureLine(ref.x.map((x, i) => x + nrm[i][0] * mid[i]), ref.y.map((y, i) => y + nrm[i][1] * mid[i]), half);
  let tumGap = null;
  if (cross && edges === 'TUM') { const g = pred.x.map((x, i) => nearest(cross.x, cross.y, x, pred.y[i])[1]); tumGap = [mean(g), pct(g, 0.95)]; tumGaps.push(tumGap[0]); }
  const pole = await poleCarData(id, years);
  const along = (arr, i) => { const d = pole.tel.distance, D = d.at(-1) * i / ref.x.length; let j = 0; while (j < d.length - 2 && d[j + 1] < D) j++; return arr[j]; };
  const r1 = v => Math.round(v * 2) / 2, edge = w => ref.x.map((x, i) => [Math.round(x + nrm[i][0] * w[i]), Math.round(ref.y[i] + nrm[i][1] * w[i])]);
  out.tracks[id] = {edges, line: pred.x.map((x, i) => [r1(x), r1(pred.y[i])]), left: edge(left), right: edge(right),
    speed: pole && ref.x.map((_, i) => Math.round(along(pole.tel.speed, i))), brake: pole && ref.x.map((_, i) => along(pole.tel.brake, i) ? 1 : 0),
    throttle: pole && ref.x.map((_, i) => Math.round(along(pole.tel.throttle, i))), pole: pole && {year: pole.year, driver: pole.d, lap: pole.lap, time: pole.time},
    check: {edgeFitM: fitM, timingInsidePct: inside, vsTumMeanM: tumGap && Math.round(tumGap[0] * 100) / 100, vsTum95M: tumGap && Math.round(tumGap[1] * 100) / 100}};
  report.push(`| ${id} | ${edges === 'TUM' ? 'TUM (measured)' : edges === 'TUM-widths' ? 'TUM widths, layout changed' : `assumed ±${ASSUMED_HALF} m`} | ${fitM ?? '–'} | ${inside != null ? inside + '%' : '–'} | ${pct(left.map((l, i) => l - right[i]), 0.5).toFixed(1)} | ${tumGap ? tumGap[0].toFixed(2) + ' / ' + tumGap[1].toFixed(2) : '–'} | ${pole ? `${pole.year} ${pole.d} ${pole.time.toFixed(3)}` : '–'} |`);
  console.log(report.at(-1));
}
out.vsTumMeanM = tumGaps.length ? mean(tumGaps) : null;
report.push('', `Predicted line vs TUM optimal line over ${tumGaps.length} tracks: mean gap ${out.vsTumMeanM?.toFixed(2)} m.`, '');
await writeFile('worker/lapsim/racing-lines-data.js', `// Generated by scripts/sim/racing-lines.mjs (edges: TUM racetrack-database, LGPL-3.0; car data: TracingInsights). Do not edit by hand.\nexport const lapsimRacingLines=${JSON.stringify(out)};\n`);
await writeFile('docs/lapsim-racing-lines.md', report.join('\n'));
console.log(report.at(-2));
