// Circuits that F1 raced in 2018-2021 but not since: geometry from the F1 car positions of that qualifying session,
// built by the production builder (scripts/sim/build-geometry.mjs) on a temporary cache, so the method is the same
// as for the production tracks. Source: TracingInsights season repositories on GitHub (FastF1 timing and positions),
// the source f1-poles.mjs and ti-races.mjs already use. Raw telemetry stays in .cache (not committed).
// Out: scripts/sim/data/tracks/extra-tracks-f1.json (derived tracks with the pole lap), read by build-geometry-extra.mjs.
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {join, resolve} from 'node:path';

export const EVENTS = [
  {id: 'hockenheim', year: 2019, event: 'German Grand Prix', name: 'Hockenheim', layout: 'Grand Prix 4.574 km', officialLengthM: 4574},
  {id: 'nurburgring-gp', year: 2020, event: 'Eifel Grand Prix', name: 'Nürburgring', layout: 'Grand Prix 5.148 km', officialLengthM: 5148},
  {id: 'mugello', year: 2020, event: 'Tuscan Grand Prix', name: 'Mugello', layout: 'Grand Prix 5.245 km', officialLengthM: 5245},
  {id: 'sakhir-outer', year: 2020, event: 'Sakhir Grand Prix', name: 'Sakhir', layout: 'Outer circuit 3.543 km', officialLengthM: 3543},
  {id: 'portimao', year: 2021, event: 'Portuguese Grand Prix', name: 'Portimão', layout: 'Algarve 4.653 km', officialLengthM: 4653},
  {id: 'paul-ricard-f1', year: 2021, event: 'French Grand Prix', name: 'Paul Ricard', layout: 'F1 layout with the Mistral chicane 5.842 km', officialLengthM: 5842},
];
const LATG_LIMIT = 7;
const CACHE = resolve(process.env.LAPSIM_F1H_CACHE || '.cache/lapsim/f1-history'), LAPS = 8;
const num = v => v === 'None' || v == null || !Number.isFinite(+v) ? null : +v;
const iso = d => String(d).slice(0, 23) + 'Z';
async function get(year, path) { // one file from the season repository, kept in the cache
  const f = join(CACHE, 'raw', String(year), path); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  const r = await fetch(`https://raw.githubusercontent.com/TracingInsights/${year}/main/${path.split('/').map(encodeURIComponent).join('/')}`, {signal: AbortSignal.timeout(60000)});
  if (!r.ok) throw new Error(`${year}/${path}: HTTP ${r.status}`);
  const t = await r.text(); mkdirSync(join(f, '..'), {recursive: true}); writeFileSync(f, t); return JSON.parse(t);
}

if (process.argv[1]?.endsWith('build-geometry-f1-history.mjs')) {
  // method check: LAPSIM_F1H_EXTRA='[{"id":"x-spielberg","year":2025,"event":"Austrian Grand Prix",...}]' builds a production circuit the same way (not written to the data file)
  const extra = JSON.parse(process.env.LAPSIM_F1H_EXTRA || '[]'); EVENTS.push(...extra);
  const only = process.argv.slice(2), index = [], circuits = {}, meta = {};
  mkdirSync(join(CACHE, 'sessions'), {recursive: true});
  for (const [k, ev] of EVENTS.entries()) {
    if (only.length && !only.includes(ev.id)) continue;
    const dir = `${ev.event}/Qualifying`, drivers = (await get(ev.year, `${dir}/drivers.json`)).drivers, all = [];
    for (const d of drivers) {
      let lt; try { lt = await get(ev.year, `${dir}/${d.driver}/laptimes.json`); } catch { continue; }
      lt.time.forEach((t, i) => { // a clean dry lap: not deleted, slick tyre, sectors add up, no rain flag
        const lap = num(t), s = [num(lt.s1[i]), num(lt.s2[i]), num(lt.s3[i])];
        if (lap == null || lt.del?.[i] || lt.wR?.[i] || !['SOFT', 'MEDIUM', 'HARD', 'ULTRASOFT', 'SUPERSOFT', 'HYPERSOFT'].includes(lt.compound?.[i]) || s.some(x => x == null) || Math.abs(s[0] + s[1] + s[2] - lap) > 0.002) return;
        all.push({driver: d.driver, team: d.team, dn: +d.dn, n: lt.lap[i], lap, s, seg: lt.qs?.[i] || '', start: iso(lt.lSD[i]), air: num(lt.wAT?.[i]), trackC: num(lt.wTT?.[i]), hum: num(lt.wH?.[i]), press: num(lt.wP?.[i]), trap: num(lt.vst?.[i])});
      });
    }
    // pole = fastest lap of the last segment (rule 3.3); then each other driver's best lap, fastest first
    const last = all.map(l => l.seg).filter(Boolean).sort().at(-1) ?? '', pole = all.filter(l => l.seg === last).sort((a, b) => a.lap - b.lap)[0];
    if (!pole) { console.log(`${ev.id}: no clean dry qualifying lap`); continue; }
    const best = new Map(); for (const l of all.sort((a, b) => a.lap - b.lap)) if (l.driver !== pole.driver && !best.has(l.driver)) best.set(l.driver, l);
    const laps = [];
    for (const [pos, l] of [pole, ...best.values()].slice(0, LAPS).entries()) {
      const tel = (await get(ev.year, `${dir}/${l.driver}/${l.n}_tel.json`)).tel, t0 = Date.parse(l.start), at = i => new Date(t0 + tel.time[i] * 1000).toISOString();
      laps.push({driver_number: l.dn, team: l.team, position: pos + 1, lap: {date_start: l.start, lap_duration: l.lap, duration_sector_1: l.s[0], duration_sector_2: l.s[1], duration_sector_3: l.s[2]},
        location: tel.time.map((_, i) => [at(i), tel.x[i], tel.y[i], tel.z[i]]).filter(r => Number.isInteger(r[1]) && Number.isInteger(r[2])), // measured positions are whole decimetres; the rest are interpolated onto the car-data clock
        carData: tel.time.map((_, i) => [at(i), tel.speed[i], tel.throttle[i], tel.brake[i] ? 100 : 0, tel.gear[i], tel.rpm[i]])});
    }
    const cj = await get(ev.year, `${dir}/corners.json`).catch(() => null);
    if (cj) circuits[String(k + 1)] = {corners: cj.CornerNumber.map((n, i) => ({number: n, letter: cj.CornerLetter?.[i] || '', trackPosition: {x: cj.X[i], y: cj.Y[i]}}))};
    writeFileSync(join(CACHE, 'sessions', ev.id + '.json'), JSON.stringify({circuit: ev.id, location: ev.name, country: '', session_key: null, year: ev.year, date_start: pole.start,
      weather: [[new Date(Date.parse(pole.start) - 60000).toISOString(), pole.air, pole.trackC, pole.hum, pole.press, 0, 0, 0]], laps}));
    index.push({circuit: ev.id, circuit_key: k + 1, year: ev.year, file: ev.id + '.json'});
    meta[ev.id] = {pole: {season: ev.year, driver: pole.driver, team: pole.team, lap: pole.lap, sectors: pole.s, segment: pole.seg, trapKph: pole.trap, airC: pole.air, trackC: pole.trackC, humidityPct: pole.hum, pressureHpa: pole.press}, lapsUsed: laps.length};
  }
  writeFileSync(join(CACHE, 'index.json'), JSON.stringify(index)); writeFileSync(join(CACHE, 'circuits.json'), JSON.stringify(circuits));
  const out = join(CACHE, 'tracks.mjs');
  console.log(execFileSync(process.execPath, ['scripts/sim/build-geometry.mjs'], {env: {LAPSIM_POS_K: '0.4', LAPSIM_KAPPA_K: '0.8', ...process.env, LAPSIM_CACHE: CACHE, LAPSIM_TRACKS_OUT: out, LAPSIM_TRACES_OUT: join(CACHE, 'traces.json')}, encoding: 'utf8'}));
  const {lapsimTracks} = await import(pathToFileURL(out).href + '?' + Date.now()), tracks = {}, traces = JSON.parse(readFileSync(join(CACHE, 'traces.json'), 'utf8'));
  // Car-free geometry check: lateral acceleration the pole lap's real speed implies on this curvature (mean over about 25 m).
  // Four production circuits built the same way give 5.0 to 6.6 g; above LATG_LIMIT the curvature is too high somewhere fast.
  const latG = t => { const p = traces.find(x => x.track === t.id && x.position === 1), n = t.kappa.length; if (!p) return null; let max = 0;
    for (let k = 0; k < p.s.length; k++) { const i = Math.round(p.s[k] / t.ds) % n; let ka = 0; for (let j = -2; j <= 2; j++) ka += Math.abs(t.kappa[(i + j + n) % n]) / 5e5; max = Math.max(max, (p.v[k] / 3.6) ** 2 * ka / 9.81); } return +max.toFixed(1); };
  for (const ev of EVENTS) { const t = lapsimTracks[ev.id]; if (!t) continue; if (extra.includes(ev)) { writeFileSync(join(CACHE, ev.id + '.json'), JSON.stringify(t)); continue; }
    const g = latG(t);
    tracks[ev.id] = {...t, latG: {max: g, limit: LATG_LIMIT, ok: g != null && g <= LATG_LIMIT}, name: ev.name, circuit: ev.name, layout: ev.layout, circuitKey: undefined, sessionKey: undefined, officialLengthM: ev.officialLengthM, lengthErrorPct: +((t.length / ev.officialLengthM - 1) * 100).toFixed(2), ...meta[ev.id],
      sources: [`TracingInsights/${ev.year} on GitHub: ${ev.event}, Qualifying (FastF1 car positions, lap times, corner positions)`]}; }
  const file = 'scripts/sim/data/tracks/extra-tracks-f1.json', prev = existsSync(file) && only.length ? JSON.parse(readFileSync(file, 'utf8')).tracks : {};
  writeFileSync(file, JSON.stringify({note: 'Tracks from F1 car positions of a 2018-2021 qualifying session, built by scripts/sim/build-geometry-f1-history.mjs with the production builder. The line is the driven line (mean of the fastest laps). Same integer scales as worker/lapsim/tracks-data.js.', tracks: {...prev, ...tracks}}));
  console.table(Object.values(tracks).map(t => ({id: t.id, year: t.year, length: t.length, official: t.officialLengthM, 'err %': t.lengthErrorPct, 'max g': t.latG.max, ok: t.latG.ok, laps: t.lapsUsed, corners: t.corners.length, pole: t.pole.lap, by: t.pole.driver, seg: t.pole.segment})));
}
