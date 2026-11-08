// Race laps and dry pole laps from the TracingInsights season repositories (FastF1 timing,
// 2018 on): per lap track status, pit in/out, deleted laps, tyre and weather. Used by
// race-pace.mjs (LAPSIM_RACE_SRC=ti). Expects sparse checkouts made by fetch-evolution.mjs or by
// cloneSeason below (laptimes.json and session_info.json of Race and Qualifying sessions).
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const GP = {bahrain: 'sakhir', 'saudi-arabian': 'jeddah', 'emilia-romagna': 'imola', 'sao-paulo': 'interlagos', brazilian: 'interlagos', 'las-vegas': 'las-vegas', qatar: 'lusail',
  'abu-dhabi': 'yas-marina-circuit', australian: 'melbourne', chinese: 'shanghai', japanese: 'suzuka', miami: 'miami', canadian: 'montreal', monaco: 'monte-carlo',
  barcelona: 'catalunya', 'barcelona-catalunya': 'catalunya', austrian: 'spielberg', british: 'silverstone', belgian: 'spa-francorchamps', hungarian: 'hungaroring', dutch: 'zandvoort', italian: 'monza',
  azerbaijan: 'baku', singapore: 'singapore', 'united-states': 'austin', 'mexico-city': 'mexico-city', mexican: 'mexico-city'};
export const tiTrack = (event, year) => { const k = slug(event.normalize('NFD').replace(/[̀-ͯ]/g, '')).replace(/-grand-prix$/, ''); return k === 'spanish' ? (year >= 2026 ? 'madring' : 'catalunya') : GP[k] || k; };
const val = v => v === 'None' || v == null ? null : v;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'];

export function cloneSeason(dir, year) {
  if (existsSync(join(dir, '.git'))) {
    execFileSync('git', ['-C', dir, 'sparse-checkout', 'add', '/*/Race/*/laptimes.json', '/*/Race/session_info.json', '/*/Qualifying/*/laptimes.json'], {stdio: 'ignore'});
    return;
  }
  execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', `https://github.com/TracingInsights/${year}`, dir], {stdio: 'inherit', env: {...process.env, GIT_LFS_SKIP_SMUDGE: '1'}});
  execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', '--no-cone', '/*/Race/*/laptimes.json', '/*/Race/session_info.json', '/*/Qualifying/*/laptimes.json'], {stdio: 'inherit'});
  execFileSync('git', ['-C', dir, 'checkout', '-q'], {stdio: 'inherit'});
}

const readLaps = d => { try { return JSON.parse(readFileSync(d, 'utf8')); } catch { return null; } };
const drivers = d => existsSync(d) ? readdirSync(d).filter(x => /^[A-Z]{3}$/.test(x)) : [];

// Fastest qualifying lap, and whether any of its session's laps ran in rain
function pole(dir) {
  let rain = 0, n = 0; const bests = [];
  for (const drv of drivers(dir)) {
    const L = readLaps(join(dir, drv, 'laptimes.json')); if (!L) continue;
    let best = Infinity;
    for (let i = 0; i < L.lap.length; i++) {
      n++; if (L.wR?.[i] === true) rain++;
      const t = val(L.time[i]); if (Number.isFinite(t) && L.del?.[i] !== true && COMPOUNDS.includes(L.compound?.[i])) best = Math.min(best, t);
    }
    if (Number.isFinite(best)) bests.push(best);
  }
  // reference lap: pole, or the mean of the best N drivers' laps (LAPSIM_RACE_TOP) to match the race reference
  const top = Math.max(1, Number(process.env.LAPSIM_RACE_TOP || 8)), b = bests.sort((x, y) => x - y).slice(0, top);
  return {pole: b.length ? b.reduce((a, x) => a + x, 0) / b.length : null, pole1: b[0] ?? null, rainShare: n ? rain / n : 0};
}

// One race: clean laps in race-pace.js form, race length, rain share, pit loss
function race(dir) {
  const out = [], pits = [], all = {};
  let rain = 0, n = 0, totalLaps = 0;
  for (const drv of drivers(dir)) {
    const L = readLaps(join(dir, drv, 'laptimes.json')); if (!L) continue;
    const rows = L.lap.map((lap, i) => ({lap, time: val(L.time[i]), compound: L.compound?.[i], age: val(L.life?.[i]), stint: val(L.stint?.[i]), status: String(L.status?.[i] ?? '1'),
      pin: val(L.pin?.[i]) != null, pout: val(L.pout?.[i]) != null, del: L.del?.[i] === true, rain: L.wR?.[i] === true, pos: val(L.pos?.[i]), team: L.team?.[i]}));
    for (const r of rows) { n++; if (r.rain) rain++; }
    const last = rows.at(-1); if (last?.pos === 1) totalLaps = last.lap;
    all[drv] = rows;
    // track status: 4 safety car, 5 red flag, 6/7 virtual safety car; 2 yellow
    const ok = rows.filter(r => Number.isFinite(r.time) && r.lap > 1 && !r.pin && !r.pout && !r.del && !/[24567]/.test(r.status) && COMPOUNDS.includes(r.compound) && Number.isFinite(r.age));
    const med = median(ok.map(r => r.time));
    for (const r of ok) if (r.time < med * 1.07) out.push({driver: drv, team: r.team, lap: r.lap, time: r.time, compound: r.compound, age: r.age, stint: r.stint});
    // pit loss: in-lap + out-lap minus two clean laps of this driver
    for (const r of rows) if (r.pin) { const o = rows.find(x => x.lap === r.lap + 1 && x.pout); if (o && Number.isFinite(r.time) && Number.isFinite(o.time) && !/[4567]/.test(r.status + o.status)) pits.push(r.time + o.time - 2 * med); }
  }
  const pl = pits.filter(x => x > 5 && x < 60);
  return {laps: out, rainShare: n ? rain / n : 0, totalLaps, pitLoss: pl.length >= 3 ? median(pl) : null};
}

// Every race of the given seasons: [{year, track, event, laps, totalLaps, rainShare, pitLoss, pole, poleRain}]
export function tiRaces(root, years) {
  const res = [];
  for (const year of years) {
    const dir = join(root, String(year));
    try { cloneSeason(dir, year); } catch (e) { console.log(`ti ${year}: ${e.message}`); continue; }
    for (const event of readdirSync(dir).filter(e => /Grand Prix$/.test(e))) {
      if (!existsSync(join(dir, event, 'Race'))) continue;
      const r = race(join(dir, event, 'Race')), q = pole(join(dir, event, 'Qualifying'));
      res.push({year, track: tiTrack(event, year), event, ...r, pole: q.pole, pole1: q.pole1, poleRain: q.rainShare});
    }
  }
  return res;
}
