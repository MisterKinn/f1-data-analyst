// Timing71 archive collector (calibration only; raw files stay in .cache, never committed).
//   node scripts/sim/t71-collect.mjs            → list + read sessions of shard $T71_SHARD of $T71_SHARDS
//   node scripts/sim/t71-collect.mjs merge      → compact summary per series in scripts/sim/data/t71/<key>.json
// Lap list = analysis JSON (flags, stints); frames add sectors, tyre, tyre age, VFT, speed trap, weather.
// Frame lap n = analysis lapNumber n+1 (checked on 19 sessions, docs/lapsim-t71.md).
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readReplay} from './t71-read.mjs';

const API = 'https://archive.timing71.org';
const CACHE = '.cache/lapsim/t71';
const OUT = 'scripts/sim/data/t71';
export const SERIES = {f1: /^formula 1$/i, wec: /^(fia )?wec$|world endurance|^le mans 24/i, imsa: /imsa weathertech/i,
  fe: /formula e/i, gtwc: /blancpain gt|gt world challenge/i, igtc: /bathurst 12|igtc|kyalami 9/i, dtm: /^dtm$/i,
  nur: /24h n(u|ü)rburgring|^nls$|^vln/i, macau: /macau grand prix/i, elms: /european le mans/i, alms: /asian le mans/i};
export const kind = d => /no current session|backup feed|\bn\/a\b/i.test(d) ? null
  : /qualif|hyperpole|superpole|shootout|duel/i.test(d) ? 'Q'
  : /race|grand prix$|\brennen\b/i.test(d) && !/pre-?race|warm/i.test(d) ? 'R' : null;

const get = async (u, n = 3) => {
  if (!/^https?:/.test(u)) u = `https://s3.us-east-005.backblazeb2.com/t71-archive/${u}`;
  try { const r = await fetch(u.startsWith(API) ? u : encodeURI(u)); if (!r.ok) throw new Error(`${r.status}`); return r; }
  catch (x) { if (n <= 1) throw x; await new Promise(f => setTimeout(f, 3000)); return get(u, n - 1); }
};
const median = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const id = r => `${new Date(r.startTime * 1e3).toISOString().slice(0, 16)} ${r.series} - ${r.description}`.replace(/[^\w.\- ]+/g, '_');

// Frame weather → numbers in SI units (°C, %, m/s, hPa); `wet` from F1 "Track" text.
export function weatherOf(spec = [], samples = []) {
  const pick = re => spec.findIndex(n => re.test(n));
  const I = {air: pick(/air/i), track: pick(/track temp/i), hum: pick(/humid/i), wind: pick(/wind speed/i), press: pick(/press/i), cond: spec.findIndex(n => /^track$/i.test(n))};
  const num = v => { const x = Array.isArray(v) ? v[0] : v; return x === '' || x == null || Number.isNaN(+x) ? null : +x; };
  const col = (k, f = num) => I[k] < 0 ? [] : samples.map(s => Array.isArray(s.v) ? f(s.v[I[k]]) : null);
  const wind = I.wind < 0 ? [] : samples.map(s => { const v = s.v?.[I.wind]; const x = num(v); return x == null ? null : /kph|km/i.test(v?.[1] || '') ? x / 3.6 : x; });
  const cond = col('cond', v => typeof v === 'string' ? v : null).filter(Boolean);
  const w = {air: median(col('air')), track: median(col('track')), hum: median(col('hum')), wind: r3(median(wind)), press: median(col('press'))};
  if (cond.length) w.wet = cond.filter(c => !/dry/i.test(c)).length / cond.length;
  return Object.values(w).some(x => x != null) ? w : null;
}

// One session → compact per-car record.
export function summarise(rep, analysis) {
  const frame = new Map(rep.laps.map(l => [`${l.car}:${l.lap + 1}`, l]));
  const cars = {};
  const ts = Object.values(analysis?.cars?.cars || {}).flatMap(c => (c.stints || []).flatMap(st => (st.laps || []).map(l => l.timestamp))).filter(Boolean);
  const t00 = ts.length ? Math.min(...ts) / 1e3 : rep.laps[0]?.t ?? null; // first completed lap (unix s)
  const src = analysis?.cars?.cars || Object.fromEntries([...new Set(rep.laps.map(l => l.car))].map(c => [c, {stints: [{laps: rep.laps.filter(l => l.car === c).map(l => ({lapNumber: l.lap + 1, laptime: l.time, flag: l.flag}))}]}]));
  for (const [car, c] of Object.entries(src)) {
    const laps = (c.stints || []).flatMap(st => st.laps || []).filter(l => l.laptime > 0);
    if (!laps.length) continue;
    const fr = l => frame.get(`${car}:${l.lapNumber}`);
    const green = laps.filter(l => l.flag === 'green');
    const best = laps.reduce((a, l) => l.laptime < a.laptime ? l : a);
    const bf = fr(best);
    // Tyre letters (S/M/H/W, one per corner when mixed) match the known WEC allocations 549/549; the colour label does not (44 wrong).
    const tyreName = l => { const t = fr(l)?.tyre; return (Array.isArray(t) ? t[0] || t[1] : t) || null; };
    const byTyre = {};
    for (const l of green) { const t = tyreName(l); if (t && (!byTyre[t] || l.laptime < byTyre[t])) byTyre[t] = l.laptime; }
    cars[car] = {cls: c.raceClass ?? fr(best)?.cls ?? null, make: c.make ?? null, team: c.teamName ?? null,
      best: r3(best.laptime), bestLap: best.lapNumber, bestFlag: best.flag, bestS: bf?.s?.map(r3) ?? null,
      bestTyre: bf?.tyre ?? null, bestAge: bf?.age ?? null, spd: Math.max(0, ...laps.map(l => fr(l)?.spd ?? 0)) || null,
      laps: laps.length, green: green.length, greenMedian: r3(median(green.map(l => l.laptime))), byTyre,
      stints: (c.stints || []).filter(st => st.laps?.length).map(st => {
        const g = st.laps.filter(l => l.flag === 'green'); const v = st.laps.map(l => fr(l)?.vft).filter(x => x != null && x !== '');
        const gb = g.length ? Math.min(...g.map(l => l.laptime)) : null; const t0 = st.laps[0].timestamp;
        // [first lap, last lap, green laps, green median, tyre, VFT first, VFT last, driver, green best, start (s since session start)]
        return [st.laps[0].lapNumber, st.laps.at(-1).lapNumber, g.length, r3(median(g.map(l => l.laptime))), tyreName(st.laps.at(-1)), v[0] ?? null, v.at(-1) ?? null, st.driver ?? null, r3(gb), t0 && t00 ? Math.round(t0 / 1e3 - t00) : null];
      })};
  }
  return cars;
}

async function collect() {
  const shard = +(process.env.T71_SHARD || 0), shards = +(process.env.T71_SHARDS || 1);
  const all = [];
  for (let skip = 0; skip < 30000; skip += 500) {
    const page = await (await get(`${API}/replays?filter[order]=startTime%20ASC&filter[limit]=500&filter[skip]=${skip}`)).json();
    all.push(...page); if (page.length < 500) break;
  }
  const pick = all.map(r => ({...r, key: Object.keys(SERIES).find(k => SERIES[k].test(r.series)), kind: kind(r.description || '')}))
    .filter(r => r.key && r.kind && r.startTime >= Date.UTC(2018, 0, 1) / 1e3);
  const only = process.env.T71_MATCH ? new RegExp(process.env.T71_MATCH, 'i') : null;
  const mine = pick.filter((r, i) => only ? only.test(r.description) : i % shards === shard);
  mkdirSync(join(CACHE, 'sessions'), {recursive: true});
  const log = {listed: all.length, picked: pick.length, shard, done: 0, failed: []};
  for (const r of mine) {
    const f = join(CACHE, 'sessions', id(r) + '.json');
    if (existsSync(f)) { log.done++; continue; }
    try {
      const zip = join(CACHE, 'r.zip');
      writeFileSync(zip, Buffer.from(await (await get(r.filename)).arrayBuffer()));
      const analysis = r.analysisFilename ? await (await get(r.analysisFilename)).json().catch(() => null) : null;
      const rep = readReplay(zip);
      writeFileSync(f, JSON.stringify({key: r.key, series: r.series, description: r.description, kind: r.kind, start: r.startTime,
        duration: r.duration, cols: rep.manifest.colSpec, weather: weatherOf(rep.manifest.trackDataSpec, rep.weather),
        frameLaps: rep.laps.length, endFlag: rep.endFlag, analysis: !!analysis, cars: summarise(rep, analysis)}));
      log.done++;
    } catch (x) { log.failed.push([r.description, String(x).slice(0, 120), (x.stack || '').split('\n').slice(1, 4).join(' | ').replace(/file:\/\/\S*\//g, '')]); }
  }
  writeFileSync(join(CACHE, `log-${shard}.json`), JSON.stringify(log));
  console.log(`shard ${shard}/${shards}: picked ${pick.length}, mine ${mine.length}, done ${log.done}, failed ${log.failed.length}`);
}

function merge() {
  const dir = join(CACHE, 'sessions'); const by = {};
  for (const f of readdirSync(dir)) { const s = JSON.parse(readFileSync(join(dir, f), 'utf8')); (by[s.key] ??= []).push(s); }
  mkdirSync(OUT, {recursive: true});
  const counts = {};
  for (const [k, list] of Object.entries(by)) {
    list.sort((a, b) => a.start - b.start);
    const txt = JSON.stringify({source: 'Timing71 archive (archive.timing71.org); calibration use only', sessions: list});
    writeFileSync(join(OUT, `${k}.json`), txt);
    counts[k] = {sessions: list.length, Q: list.filter(s => s.kind === 'Q').length, R: list.filter(s => s.kind === 'R').length,
      noCars: list.filter(s => !Object.keys(s.cars).length).length, MB: +(txt.length / 1e6).toFixed(2)};
  }
  const logs = readdirSync(CACHE).filter(f => /^log-\d+\.json$/.test(f)).map(f => JSON.parse(readFileSync(join(CACHE, f), 'utf8')));
  writeFileSync(join(OUT, 'counts.json'), JSON.stringify({counts, failed: logs.flatMap(l => l.failed)}, null, 1));
  console.table(counts);
}

if (process.argv[1]?.endsWith('t71-collect.mjs')) await (process.argv[2] === 'merge' ? merge() : collect());
