// Step 29b: ± ranges for LapSim Δ answers (rule: docs/prereg/step29b-delta-intervals-2026-11-25.md).
// DRS: runs the Δ bench (f1-delta-bench.mjs model, ~4 s) on the pinned pooled cases with the working calibration;
// lap: the held-out rows of the working calibration. Writes worker/lapsim/delta-intervals-data.js.
//   node scripts/sim/delta-intervals.mjs [--run <id> --mode production|refit|research] [--out <path>] [--check]
// --run is required for any calibration other than the step-29b one (every number cites a run id, AGENTS.md).
// --mode research never writes the production file (worker/lapsim/delta-intervals-data.js): give --out.
import {readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {calFingerprint} from '../../worker/lapsim/delta-intervals.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = p => createHash('sha256').update(readFileSync(p.startsWith('/') ? p : root + p)).digest('hex');
const CAL = 'worker/lapsim/calibration-data.js', CASES = 'scripts/sim/data/f1-delta/f1-delta-cases-pooled-2026-11-24.csv';
const RULE = 'docs/prereg/step29b-delta-intervals-2026-11-25.md', OUT = 'worker/lapsim/delta-intervals-data.js', SIGMA = 'scripts/sim/data/sigma-meas-v2.json';
// the step-29b calibration and its sources (PR #519): bench baseline = run 45487971969, held-out RMS = run 45402981435 base
const CAL29B = 'b5cc83df9aab550a2934691a9976a11f1d71d8350b2d331754ce21baff135861', TIE = {all: 0.901, f1: 0.823, wec: 0.977};

// Hyndman–Fan type 7 (numpy default)
export function quantile(xs, p) {
  const s = [...xs].sort((a, b) => a - b), h = (s.length - 1) * p, lo = Math.floor(h);
  return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]);
}
const r4 = x => Math.round(x * 1e4) / 1e4;

// research ranges never replace the production file; any other mode may
export function mayWrite(mode, out) { return mode !== 'research' || (out !== OUT && !out.endsWith('/' + OUT)); }

function bench() {
  const pin = JSON.parse(readFileSync(root + '.github/lapsim-snapshot.json', 'utf8')).delta.v2pooled;
  if (pin.path !== CASES || sha(CASES) !== pin.sha256) throw Error('pooled DRS cases differ from the pin');
  const dir = mkdtempSync(join(tmpdir(), 'delta-')), node = (...a) => spawnSync(process.execPath, [root + 'scripts/sim/f1-delta-bench.mjs', ...a], {encoding: 'utf8', cwd: root, maxBuffer: 1 << 26});
  try {
    const z = node('zones'); if (z.status) throw Error(z.stderr);
    writeFileSync(join(dir, 'zones.csv'), z.stdout); copyFileSync(root + CASES, join(dir, 'f1-delta-cases-2026-11-24.csv'));
    const m = node('model', dir); if (m.status) throw Error(m.stderr);
    return {text: readFileSync(join(dir, 'baseline.csv'), 'utf8'), sha256: sha(join(dir, 'baseline.csv'))};
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

export async function build({run, mode} = {}) {
  const calSha = sha(CAL), own = calSha === CAL29B;
  if (!own && !run) throw Error('another calibration than step 29b: give --run <pipeline or lapsim-data run id>');
  const {lapsimCalibration: c} = await import(root + CAL);
  // R2 DRS: ρ = measured / model per pooled event × zone case
  const b = bench(), [head, ...rows] = b.text.trim().split(/\r?\n/);
  const col = head.split(','), im = col.indexOf('meas_delta_s'), ip = col.indexOf('pred_delta_s');
  const rho = rows.map(l => l.split(',')).map(f => +f[im] / +f[ip]);
  if (rho.length !== 125 || rho.some(x => !Number.isFinite(x))) throw Error(`DRS cases: expected 125 finite ratios, got ${rho.length}`);
  // R3 lap level: e = errorSec / realLap per held-out row
  const e = {f1: [], wec: []};
  for (const y of ['2025', '2026']) for (const t of c.seasons[y].holdout.tracks) e.f1.push(t.errorSec / c.seasons[y].tracks[t.track].realLap);
  for (const cls of ['lmh', 'lmdh', 'lmgt3']) for (const y of ['2025', '2026']) { const s = c.series.wec[cls][y]; for (const t of s.holdout.tracks) e.wec.push(t.errorSec / s.tracks[t.track].realLap); }
  e.all = [...e.f1, ...e.wec];
  const rms = xs => Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / xs.length) * 100;
  if (own) for (const g of ['all', 'f1', 'wec']) if (Math.abs(rms(e[g]) - TIE[g]) > 0.001 + 5e-4) throw Error(`R3 tie failed: ${g} RMS ${rms(e[g]).toFixed(4)} % vs run 45402981435 ${TIE[g]} %`);
  const lap = g => ({n: e[g].length, q05: r4(quantile(e[g], 0.05)), q50: r4(quantile(e[g], 0.5)), q95: r4(quantile(e[g], 0.95)), rmsPct: r4(rms(e[g]))});
  const drsRun = run || '45487971969', lapRun = run || '45402981435';
  // step 36 (report-only): gap to the noise floor = held-out RMS ÷ σ_meas v2 per class and season (definition-100 criterion 1: ≤ 1.2)
  const S = JSON.parse(readFileSync(root + SIGMA, 'utf8')), r3 = x => +x.toFixed(3), gap = (xs, k) => { const h = rms(xs), s = S.classes[k];
    return {n: xs.length, heldOutPct: r4(h), sigmaPct: s.pct, ratio: r3(h / s.pct), ratio90: [r3(h / s.ci90[1]), r3(h / s.ci90[0])], atFloor: h / s.pct <= 1.2}; };
  const gr = {}; for (const y of ['2025', '2026']) gr[`f1/${y}`] = gap(c.seasons[y].holdout.tracks.map(t => t.errorSec / c.seasons[y].tracks[t.track].realLap), 'f1');
  for (const cls of ['lmh', 'lmdh', 'lmgt3']) for (const y of ['2025', '2026']) { const s = c.series.wec[cls][y]; gr[`wec-${cls}/${y}`] = gap(s.holdout.tracks.map(t => t.errorSec / s.tracks[t.track].realLap), 'wec-' + cls); }
  gr.f1 = gap(e.f1, 'f1');
  return {
    rule: {path: RULE, sha256: sha(RULE)}, level: 0.9, quantile: 'empirical, type 7 (numpy default); no normal assumption',
    built: {run: run || null, mode: run ? mode || 'production' : 'step 29b PR #519'},
    calibration: {path: CAL, sha256: calSha, generatedAt: c.generatedAt, fingerprint: calFingerprint(c)},
    drs: {status: 'checked', n: rho.length, q05: r4(quantile(rho, 0.05)), q50: r4(quantile(rho, 0.5)), q95: r4(quantile(rho, 0.95)),
      source: {path: CASES, sha256: sha(CASES), baselineSha256: b.sha256, run: drsRun, note: `Δ bench (f1-delta-bench.mjs model) on this calibration, run ${drsRun}`},
      unit: 'ratio measured Δ / model Δ per pooled event × zone case, 2023–25 races'},
    lap: {status: 'checked', f1: lap('f1'), wec: lap('wec'), source: {run: lapRun, note: `held-out rows of this calibration (run ${lapRun})`},
      unit: 'e = simulated / real − 1 per held-out row'},
    gapToFloor: {status: 'report-only', unit: 'held-out RMS ÷ σ_meas v2 (criterion 1 of the definition of 100: ≤ 1.2 = at the floor)',
      sigma: {path: SIGMA, sha256: sha(SIGMA), definitionSha256: S.definitionSha256, run: S.run}, rows: gr},
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const mode = arg('--mode'), out = arg('--out') || OUT;
  if (!mayWrite(mode, out)) { console.error(`research ranges never overwrite ${OUT}: give --out`); process.exit(2); }
  const d = await build({run: arg('--run'), mode});
  const text = `// generated by scripts/sim/delta-intervals.mjs (step 29b); do not edit by hand\nexport const lapsimDeltaIntervals = ${JSON.stringify(d)};\n`;
  if (process.argv.includes('--check')) { const same = readFileSync(root + OUT, 'utf8') === text; console.log(same ? 'delta intervals up to date' : 'delta intervals stale: rebuild with node scripts/sim/delta-intervals.mjs'); process.exit(same ? 0 : 1); }
  writeFileSync(out.startsWith('/') ? out : root + out, text);
  console.log(`wrote ${out}: DRS ρ 90 % ${d.drs.q05}…${d.drs.q95}, lap F1 ${d.lap.f1.q05}…${d.lap.f1.q95}, WEC ${d.lap.wec.q05}…${d.lap.wec.q95} (run ${d.built.run ?? '–'}, ${d.built.mode})`);
}
