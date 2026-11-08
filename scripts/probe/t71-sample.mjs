// Probe: download a few Timing71 analysis JSONs and replay ZIP manifests; write their structure.
import {writeFileSync, mkdirSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const d = JSON.parse(readFileSync('probe-out/t71.json', 'utf8'));
const pick = (s, re) => d.replays.find(r => s.test(r.series) && re.test(r.description));
const want = [[/WeatherTech SportsCar Championship$/, /Qualif/], [/Formula E World/, /Qualif/], [/^DTM$/, /Qualif/], [/GT World Challenge America/, /Qualif/], [/FIA World Endurance/, /Qualifying - HYPERCAR/], [/^Formula 1$/, /Qualif/]];
const shape = (v, depth = 0) => depth > 4 ? typeof v : Array.isArray(v) ? [v.length, shape(v[0], depth + 1)] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).slice(0, 40).map(([k, x]) => [k, shape(x, depth + 1)])) : v;
const out = [];
mkdirSync('probe-out/samples', {recursive: true});
for (const [s, re] of want) {
  const r = pick(s, re); if (!r) { out.push({miss: String(s)}); continue; }
  const e = {series: r.series, description: r.description};
  try { const a = await (await fetch(encodeURI(r.analysisFilename))).json(); e.analysisShape = shape(a); e.analysisSize = JSON.stringify(a).length;
    const car = a.cars ? Object.entries(a.cars)[0] : null; e.carSample = car && JSON.stringify(car).slice(0, 4000); } catch (x) { e.analysisError = String(x); }
  try { const b = Buffer.from(await (await fetch(encodeURI(r.filename))).arrayBuffer()); writeFileSync('/tmp/r.zip', b); e.zipSize = b.length;
    e.manifest = JSON.parse(execFileSync('unzip', ['-p', '/tmp/r.zip', 'manifest.json']).toString());
    const names = execFileSync('unzip', ['-Z1', '/tmp/r.zip']).toString().split('\n').filter(Boolean); e.frames = names.length;
    const last = names.filter(n => /^\d+\.json$/.test(n)).sort().pop(); e.lastFrame = execFileSync('unzip', ['-p', '/tmp/r.zip', last]).toString().slice(0, 4000); } catch (x) { e.zipError = String(x); }
  out.push(e);
}
writeFileSync('probe-out/samples.json', JSON.stringify(out, null, 1));
