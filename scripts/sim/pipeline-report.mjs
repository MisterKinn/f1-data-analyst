// LapSim pipeline report (step 27, .github/workflows/lapsim-pipeline.yml): one JSON + markdown per run, tying every number to the run id,
// the input snapshot hashes, the code commit and the settings. No model code here: it only reads the fit outputs.
//   node scripts/sim/pipeline-report.mjs <new calibration-data.js> <shipped calibration-data.js> <out dir>
// Env: GITHUB_RUN_ID, GITHUB_SHA, SHIPPED_DIR, FIT_RESULT, TRACK_STATE_DIFF (track-state-diff.mjs JSON), SNAPSHOT_TAG, SNAPSHOT_SHA256, SNAPSHOT_SUMS (path of SHA256SUMS), DELTA_DIR (Δ benchmark output dir).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {heldOut, compare} from './exp-compare.mjs';

const CAR_KEYS = ['muX', 'muY', 'muXTrac', 'clA', 'cdA', 'cdALow', 'pIce'];
const r4 = x => Number.isFinite(x) ? +x.toFixed(4) : null;

// shipped vs new: held-out RMS per group, the largest per-row change, and every car parameter that moved
export function diff(shipped, cand) {
  const a = heldOut(shipped), b = heldOut(cand), rows = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!(k in a) || !(k in b) || Math.abs(a[k] - b[k]) > 1e-9) rows.push({row: k, shippedPct: r4(a[k]), newPct: r4(b[k])});
  const cars = [], add = (where, x, y) => { for (const k of CAR_KEYS) if (Number.isFinite(x?.[k]) && Math.abs(x[k] - (y?.[k] ?? NaN)) > 1e-9 * Math.max(1, Math.abs(x[k]))) cars.push({where, param: k, shipped: r4(x[k]), new: r4(y?.[k])}); };
  for (const [y, s] of Object.entries(shipped.seasons || {})) add(`f1 ${y}`, s.car, cand.seasons?.[y]?.car);
  for (const [cls, ys] of Object.entries(shipped.series?.wec || {})) for (const [y, s] of Object.entries(ys)) add(`wec-${cls} ${y}`, s.car, cand.series?.wec?.[cls]?.[y]?.car);
  return {heldOut: compare(shipped, cand), changedRows: rows, changedCarParams: cars, identical: rows.length === 0 && cars.length === 0};
}

const sum = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).summary ?? null : null;
const md = r => [
  `# LapSim pipeline report — run ${r.run.id}`, '',
  `Commit \`${r.run.commit}\` · snapshot \`${r.inputs.tag}\` (sha256 \`${r.inputs.sha256}\`) · generated ${r.generatedAt}`, '',
  `Fit settings (.github/lapsim-fit.env): ${Object.entries(r.settings).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}. Seeds: ${r.seeds}.`, '',
  `Fit job: ${r.fit}.`, '',
  ...(r.diff ? fitMd(r) : ['No fit output in this run.', '']),
  '## Change-effects table (track-state build on the pinned inputs)', '',
  ...(r.trackState ? [`Effects ${r.trackState.identical ? '**identical** to the shipped table' : `**${r.trackState.effects.length} fields differ**`}; registry tracks changed: ${r.trackState.registryTracksChanged.join(', ') || 'none'}; year pairs changed: ${r.trackState.pairsChanged}.` + (r.trackState.cases ? ` Cases ${r.trackState.cases.n} on ${r.trackState.cases.circuits} circuits, skipped ${r.trackState.cases.skipped} (${Object.entries(r.trackState.cases.skippedWhy).map(([k, v]) => `${k} ${v}`).join(', ')}).` : ''), '',
    ...(r.trackState.effects.length ? ['| type | field | shipped | this run |', '|---|---|---|---|', ...r.trackState.effects.map(e => `| ${e.type} | ${e.field} | ${JSON.stringify(e.shipped)} | ${JSON.stringify(e.new)} |`), ''] : [])] : ['Not run.', '']),
  '## Δ benchmarks', '', ...r.delta.map(d => `- ${d.name}: ${d.result}`), '',
  '## Inputs (SHA256SUMS of the snapshot)', '', '```', r.inputs.sums.trim(), '```', ''].join('\n');
const fitMd = r => [
  '## Held-out lap error (RMS %, shipped → this run)', '', '| group | n | shipped | this run |', '|---|---|---|---|',
  ...Object.entries(r.diff.heldOut).map(([g, x]) => `| ${g} | ${x.n} | ${x.base} | ${x.cand} |`), '',
  `Reproduction: ${r.diff.identical ? '**identical** to the shipped calibration (every held-out row and car parameter).' : `**${r.diff.changedRows.length} held-out rows and ${r.diff.changedCarParams.length} car parameters differ** (tables below).`}`, '',
  ...(r.diff.changedCarParams.length ? ['| car | param | shipped | this run |', '|---|---|---|---|', ...r.diff.changedCarParams.map(c => `| ${c.where} | ${c.param} | ${c.shipped} | ${c.new} |`), ''] : []),
  ...(r.diff.changedRows.length ? ['| held-out row | shipped % | this run % |', '|---|---|---|', ...r.diff.changedRows.map(c => `| ${c.row} | ${c.shippedPct} | ${c.newPct} |`), ''] : []),
  '## Level C and forward chaining (RMS %, shipped → this run)', '', '| group | level C shipped | level C | forward shipped | forward |', '|---|---|---|---|---|',
  ...Object.keys({...r.levelC.new, ...r.forward.new}).map(g => `| ${g} | ${[r.levelC.shipped, r.levelC.new, r.forward.shipped, r.forward.new].map(x => x?.[g]?.rmsPct ?? '–').join(' | ')} |`), ''];

if (process.argv[1]?.endsWith('pipeline-report.mjs')) {
  const [newF, shippedF, out] = process.argv.slice(2), E = process.env;
  const load = async f => (await import(pathToFileURL(f).href)).lapsimCalibration;
  const settings = Object.fromEntries(readFileSync('.github/lapsim-fit.env', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => l.split(/=(.*)/s).slice(0, 2)));
  const dd = E.DELTA_DIR || '', drs = sum('scripts/sim/data/f1-delta/cases-summary.json') || {};
  const nModel = existsSync(dd + '/baseline.csv') ? readFileSync(dd + '/baseline.csv', 'utf8').trim().split('\n').length - 1 : null;
  const r = {
    generatedAt: new Date().toISOString(),
    run: {id: E.GITHUB_RUN_ID || 'local', commit: E.GITHUB_SHA || 'local', url: E.GITHUB_RUN_ID ? `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}/actions/runs/${E.GITHUB_RUN_ID}` : null},
    inputs: {tag: E.SNAPSHOT_TAG || '', sha256: E.SNAPSHOT_SHA256 || '', sums: E.SNAPSHOT_SUMS && existsSync(E.SNAPSHOT_SUMS) ? readFileSync(E.SNAPSHOT_SUMS, 'utf8') : ''},
    settings, seeds: 'fit: none (deterministic Nelder–Mead / BCD); condition-report bootstrap seed 7; gate.mjs sign-flip / bootstrap seed 1',
    fit: E.FIT_RESULT || 'local',
    diff: existsSync(newF) ? diff(await load(shippedF), await load(newF)) : null,
    trackState: E.TRACK_STATE_DIFF && existsSync(E.TRACK_STATE_DIFF) ? JSON.parse(readFileSync(E.TRACK_STATE_DIFF, 'utf8')) : null,
    // SHIPPED_DIR: the committed level C / forward files, copied before the run's outputs overwrite docs/
    levelC: {shipped: sum(`${E.SHIPPED_DIR}/lapsim-level-c.json`), new: sum('docs/lapsim-level-c.json')},
    forward: {shipped: sum(`${E.SHIPPED_DIR}/lapsim-forward.json`), new: sum('docs/lapsim-forward.json')},
    delta: [
      {name: 'F1 DRS Δ v1 (step 24, f1-delta-bench.mjs model, committed case list)', result: nModel == null ? 'not run' : `${nModel} model rows on kept cases; noise stop: ${Object.entries(drs).map(([u, s]) => `${u} ${s.stop ? 'stop' : 'kept ' + s.n_kept}`).join(', ')}`},
      {name: 'F1 pooled DRS Δ v2 (step 24 v2)', result: 'not on main (branch step24-v2, pre-registration pending)'},
      {name: 'WEC BoP Δ v2 (step 21)', result: 'not on main; report-only after the σ_meas stop (0.82 s > 0.1 s)'},
    ],
  };
  writeFileSync(out + '/pipeline-report.json', JSON.stringify(r, null, 1) + '\n');
  writeFileSync(out + '/pipeline-report.md', md(r));
  console.log(md(r));
}
