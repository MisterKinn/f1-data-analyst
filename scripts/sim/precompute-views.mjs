// First-view job (owner 2026-11-18), stage 2: store the lap simulator's first view of every track × car, so the page can show it at
// once. The views come from the page's own worker code path (lapsimScript() run with no document), from the page data the server
// sends, for the state the page builds for a car's first view (worker/lapsim/view-keys.js). GT3 cars are left out: they compute in
// about 0.1 s; so are the per-maker Hypercars (size, see `cars`). Output (not committed; published to the fork's GitHub Pages by .github/workflows/lapsim-views.yml, which checks out
// upstream main every hour and runs this script):
//   <out>/<build>/<state hash>.json = {build, state, v}    build = script version + hash of the page data without carId
//   <out>/manifest-<shard>.json     = [{track, lang, car, build, file, ms}]
// Usage: node scripts/sim/precompute-views.mjs <out dir> [k/n shard] [--check <dir> <share>]
//   --check: recompute a random share of the views in <dir> (and every F1 view of Spa, Silverstone and Suzuka) in this fresh process
//            and exit 1 on any difference.
import {mkdirSync, writeFileSync, readFileSync, readdirSync} from 'node:fs';
import {simulationPage, lapsimScript, lapsimScriptVersion} from '../../worker/simulation.js';
import {lapsimTracks, lapsimExtraTracks} from '../../worker/lapsim/tracks-data.js';
import {viewHash, canonJson, viewBuildKey, firstViewState} from '../../worker/lapsim/view-keys.js';

const args = process.argv.slice(2), checkAt = args.indexOf('--check');
const pageData = html => html.match(/<script type="application\/json" id="lapsim-data">([\s\S]*?)<\/script>/)[1];
// the worker side of the page script: page data once, then one state per message (as in the browser)
let posted = null; globalThis.self = {postMessage: m => { posted = structuredClone(m); }};
(0, eval)(lapsimScript());
const version = lapsimScriptVersion();
const viewOf = (data, state) => { posted = null; self.onmessage({data: {id: 1, state: structuredClone(state)}}); if (!posted || posted.err) throw new Error(posted?.err || 'no answer'); return posted.v; };
// stored for the cars a first visit opens most (F1, the WEC class cars, FE); the per-maker Hypercars (hyper-*) are left out to keep
// the Pages site under 800 MB (1.11 GB with them, limit 1 GB): the page computes those on demand like any view not stored
const cars = data => Object.keys(data.cars).filter(k => !k.startsWith('gt3-') && !k.startsWith('hyper-'));
// JSON writes -0 as 0 (telemetry lanes hold -0): keep it, so the file parses back to the exact numbers
const exactJson = x => JSON.stringify(x, (k, y) => Object.is(y, -0) ? '\u0000NEG0' : y).replaceAll('"\\u0000NEG0"', '-0');

if (checkAt >= 0) {
  const dir = args[checkAt + 1], share = Number(args[checkAt + 2] ?? 0.03), must = ['spa-francorchamps', 'silverstone', 'suzuka'];
  const rows = readdirSync(dir).filter(f => /^manifest-.*\.json$/.test(f)).flatMap(f => JSON.parse(readFileSync(dir + '/' + f, 'utf8')));
  const pick = rows.filter(r => (must.includes(r.track) && /^20\d\d$/.test(r.car)) || Math.random() < share);
  let bad = 0, last = '';
  for (const r of pick) {
    const text = pageData(simulationPage({track: r.track}, r.lang)), data = JSON.parse(text);
    if (viewBuildKey(version, text) !== r.build) { console.log('build changed', r.track, r.lang); bad++; continue; }
    if (last !== r.track + r.lang) { self.onmessage({data: {data}}); last = r.track + r.lang; }
    const stored = JSON.parse(readFileSync(dir + '/' + r.file, 'utf8')), state = firstViewState(data, r.car);
    if (stored.state !== canonJson(state) || exactJson(viewOf(data, state)) !== exactJson(stored.v)) { console.log('DIFFERENT', r.track, r.lang, r.car); bad++; }
  }
  console.log(`checked ${pick.length} of ${rows.length} views, ${bad} different`);
  process.exit(bad ? 1 : 0);
}

const [out, shard = '0/1'] = args, [k, n] = shard.split('/').map(Number);
const ids = [...Object.keys(lapsimTracks), ...Object.keys(lapsimExtraTracks)].sort().filter((_, i) => i % n === k), rows = [];
for (const track of ids) for (const lang of ['ko', 'en']) {
  const text = pageData(simulationPage({track}, lang)), data = JSON.parse(text), build = viewBuildKey(version, text);
  self.onmessage({data: {data}}); mkdirSync(out + '/' + build, {recursive: true});
  for (const car of cars(data)) {
    const state = firstViewState(data, car), key = canonJson(state), t0 = performance.now(), v = viewOf(data, state), ms = Math.round(performance.now() - t0);
    const file = build + '/' + viewHash(key) + '.json';
    writeFileSync(out + '/' + file, exactJson({build, state: key, v}));
    rows.push({track, lang, car, build, file, ms});
  }
  console.log(track, lang, cars(data).length, 'views');
}
writeFileSync(out + '/manifest-' + k + '.json', JSON.stringify(rows));
