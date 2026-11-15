// Per F1 session: when the Race Director declared Low/Normal Grip Conditions (2026 Straight Mode then uses the low-grip (Alt)
// activation points, Sporting Regulations B1.5.11), and when Overtake (2026) or DRS (to 2025) was disabled or enabled.
// Owner 2026-11-16 (Brazil 2026 qualifying ran in Low Grip Conditions with Overtake disabled): learn which zone set each session used.
// Source: OpenF1 race control (copies of the live race-control messages). Runs in GitHub Actions; out: scripts/sim/data/learn/f1-aero-state.json.
import {writeFile} from 'node:fs/promises';
import {resolveTrack} from '../../../worker/lapsim/names.js';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';

const API = 'https://api.openf1.org/v1/', ids = Object.keys(lapsimTracks);
const get = async q => { for (let k = 0; k < 4; k++) { const r = await fetch(API + q); if (r.ok) return r.json(); await new Promise(f => setTimeout(f, 2000 * (k + 1))); } throw new Error('OpenF1 ' + q); };
const KINDS = [['LOW GRIP CONDITIONS', 'grip', 'low'], ['NORMAL GRIP CONDITIONS', 'grip', 'normal'], ['OVERTAKE DISABLED', 'ot', 'off'], ['OVERTAKE ENABLED', 'ot', 'on'],
  ['DRS DISABLED', 'drs', 'off'], ['DRS ENABLED', 'drs', 'on'], ['WET TRACK', 'wet', 'wet']];
const year0 = 2025, year1 = new Date().getUTCFullYear(), sessions = {};
for (let y = year0; y <= year1; y++) for (const s of await get('sessions?year=' + y)) sessions[s.session_key] = s;
const out = {source: 'OpenF1 race control (copies of F1 race-control messages)', generatedAt: new Date().toISOString(), sessions: {}};
for (const [msg, kind, state] of KINDS) {
  for (const m of await get('race_control?message=' + encodeURIComponent(msg) + '&date>=' + year0 + '-01-01')) {
    const s = sessions[m.session_key]; if (!s) continue;
    const e = out.sessions[m.session_key] ||= {year: s.year, track: resolveTrack(s.circuit_short_name, ids) || resolveTrack(s.location, ids) || resolveTrack(s.country_name, ids) || null,
      circuit: s.circuit_short_name, session: s.session_name, start: s.date_start, end: s.date_end, events: []};
    e.events.push({t: m.date, kind, state, ...(m.lap_number ? {lap: m.lap_number} : {})});
  }
}
// state at the green flag and at the end (what the session's laps mostly ran on); "mixed" when it changed after the start
for (const e of Object.values(out.sessions)) {
  e.events.sort((a, b) => a.t.localeCompare(b.t));
  const at = (kind, t) => { let v = null; for (const x of e.events) if (x.kind === kind && x.t <= t) v = x.state; return v; };
  const changes = kind => e.events.filter(x => x.kind === kind && x.t > e.start && x.t < e.end).length;
  e.grip = {start: at('grip', e.start) || 'normal', end: at('grip', e.end) || 'normal', changes: changes('grip')};
  e.ot = e.year >= 2026 ? {start: at('ot', e.start) || 'on', end: at('ot', e.end) || 'on'} : undefined;
  e.drs = e.year < 2026 ? {start: at('drs', e.start) || 'on', end: at('drs', e.end) || 'on'} : undefined;
}
await writeFile('scripts/sim/data/learn/f1-aero-state.json', JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out.sessions).filter(([, e]) => e.grip.start === 'low' || e.grip.end === 'low').map(([k, e]) => `${k} ${e.year} ${e.track} ${e.session}: grip ${e.grip.start}->${e.grip.end}`).join('\n'));
