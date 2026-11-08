// WEC compound effect from Timing71 race stints (tyre letters per corner). Gate: kept only if
// leave-one-event-out error beats "no effect" (the page's current "lap unchanged").
//   node scripts/sim/wec-tyre-fit.mjs  → scripts/sim/data/wec-tyre-effect.json
import {readFileSync, writeFileSync} from 'node:fs';
import {mapSessions} from './t71-tracks.mjs';
import {gate} from './gate.mjs';

const SCORE = {S: 0, M: 1, H: 2};
export const tyreScore = t => { const l = [...String(t || '')].filter(c => c in SCORE); return l.length && l.length === String(t).length ? l.reduce((a, c) => a + SCORE[c], 0) / l.length : null; };
const clsOf = c => /hyper/i.test(c || '') ? 'hypercar' : /gt3/i.test(c || '') ? 'lmgt3' : null;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };

// Theil–Sen line (robust to traffic/FCY outliers): y = a + b·x
function theilSen(xs, ys) {
  const sl = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[j] !== xs[i]) sl.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  const b = sl.length ? median(sl) : 0;
  return {a: median(xs.map((x, i) => ys[i] - b * x)), b};
}

export function rows(sessions, sameDriver = false) {
  const out = [];
  for (const s of sessions.filter(s => s.kind === 'R')) {
    for (const cls of ['hypercar', 'lmgt3']) {
      const st = [];
      for (const [car, c] of Object.entries(s.cars)) {
        if (clsOf(c.cls) !== cls) continue;
        for (const x of c.stints) {
          const [, , green, , tyre, , , driver, best, start] = x;
          const sc = tyreScore(tyre);
          if (green >= 5 && best && start != null && sc != null) st.push({car, driver, best, start, sc});
        }
      }
      if (st.length < 8) continue;
      const {a, b} = theilSen(st.map(r => r.start), st.map(r => r.best));
      for (const r of st) r.res = 100 * (r.best / (a + b * r.start) - 1); // % vs race trend
      const byCar = {};
      for (const r of st) (byCar[sameDriver ? `${r.car}/${r.driver}` : r.car] ??= []).push(r);
      for (const list of Object.values(byCar)) {
        if (new Set(list.map(r => r.sc)).size < 2) continue; // need two compounds on one car
        const mr = list.reduce((p, r) => p + r.res, 0) / list.length, ms = list.reduce((p, r) => p + r.sc, 0) / list.length;
        for (const r of list) out.push({event: `${s.track}-${new Date(s.start * 1e3).getUTCFullYear()}`, cls, y: r.res - mr, x: r.sc - ms});
      }
    }
  }
  return out;
}

const fitK = rs => { const sxx = rs.reduce((p, r) => p + r.x * r.x, 0); return sxx ? rs.reduce((p, r) => p + r.x * r.y, 0) / sxx : 0; };

if (process.argv[1]?.endsWith('wec-tyre-fit.mjs')) {
  const sessions = mapSessions(JSON.parse(readFileSync('scripts/sim/data/t71/wec.json', 'utf8')).sessions.map(s => ({...s, key: 'wec'})));
  const result = {method: 'within-car stint best vs race trend (Theil–Sen), tyre score S0/M1/H2 per corner; LOO by event; gate vs no effect. Variants declared before testing: same car, same car + same driver', classes: {}};
  for (const [variant, all] of [['sameCar', rows(sessions)], ['sameDriver', rows(sessions, true)]]) for (const cls of ['hypercar', 'lmgt3']) {
    const rs = all.filter(r => r.cls === cls);
    const events = [...new Set(rs.map(r => r.event))];
    const eCur = [], eNew = [];
    for (const ev of events) {
      const k = fitK(rs.filter(r => r.event !== ev));
      for (const r of rs.filter(r => r.event === ev)) { eCur.push(r.y); eNew.push(r.y - k * r.x); }
    }
    const g = gate(eCur, eNew);
    result.classes[`${cls}/${variant}`] = {kPctPerStep: +fitK(rs).toFixed(3), rows: rs.length, events: events.length, looRmsNoEffect: +g.rmsCur.toFixed(3), looRmsModel: +g.rmsNew.toFixed(3), gate: g.reason, accept: g.accept};
  }
  writeFileSync('scripts/sim/data/wec-tyre-effect.json', JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
}
