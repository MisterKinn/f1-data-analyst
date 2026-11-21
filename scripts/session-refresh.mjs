// Session-end dispatcher (owner 2026-11-21: data refreshes after every session of every series we can read).
// Reads the site's own calendar (worker/race-calendar-data.js + worker/session-schedule.js), finds sessions that ended
// 45-75 min, 2h45-3h15 or 5h45-6h15 ago (three tries, as sources lag 1-3 h; the dispatcher runs every 30 min, so each
// session hits each window once) and prints the refresh workflows to start. The workflows are idempotent: no new data, no commit.
//   node scripts/session-refresh.mjs [--now=ISO]   -> JSON {run: [workflow files], sessions: [...], unwired: [...]}
import {calendarEvents} from '../worker/race-calendar-data.js';
import {sessionSchedule} from '../worker/session-schedule.js';

// typical session length (h) by kind; endurance races by series
const RACE_H = {wec: 8, imsa: 8, elms: 4, alms: 4, 'gtwc-europe': 3, 'gtwc-america': 3, 'gtwc-asia': 1, 'gtwc-australia': 3, igtc: 12,
  '24h-series': 24, 'super-taikyu': 5, f1: 2, 'formula-e': 1.5, nls: 6, 'super-gt': 3, 'british-gt': 2, nascar: 3.5, wrc: 4, dakar: 10, macau: 1};
const kind = n => /race|grand prix ·|main/i.test(n) && !/qualif|practice|warm/i.test(n) ? 'race' : /qualif|hyperpole|pole|q[123]\b/i.test(n) ? 'qualifying' : 'practice';
const hours = (series, k, name) => k === 'race' ? (/\b(\d+)\s*h(ours)?\b/i.exec(name)?.[1] * 1 || RACE_H[series] || 2) : 1;
// what each series can refresh today (workflow files; all publish through scripts/publish-refresh.sh)
const WIRED = {
  f1: {qualifying: ['f1-zones-refresh.yml'], race: ['f1-zones-refresh.yml']},  // zones/grip state + real poles; ERS clipping runs every 30 min itself
  wec: {qualifying: ['bop-refresh.yml'], race: ['bop-refresh.yml', 'lapsim-track-laps.yml']},
  imsa: {race: ['bop-refresh.yml', 'lapsim-track-laps.yml']},
  elms: {race: ['bop-refresh.yml']},
  'gtwc-america': {practice: ['alkamel-laps.yml'], qualifying: ['alkamel-laps.yml'], race: ['alkamel-laps.yml']},  // Al Kamel every lap
  igtc: {race: ['alkamel-laps.yml']},  // Indianapolis 8 Hour is on Al Kamel; the other IGTC rounds have no source wired
};
const WINDOWS = [[45, 75], [165, 195], [345, 375]];

export function plan(now = new Date(), events = calendarEvents, schedule = sessionSchedule) {
  const run = new Set(), sessions = [], unwired = new Set();
  for (const e of events) {
    const list = (schedule[e.id] || []).map(s => ({name: s.nameEn || s.name, start: Date.parse(s.start)}));
    if (!list.length && e.raceStart) list.push({name: 'Race', start: Date.parse(e.raceStart)});
    for (const s of list) {
      if (!Number.isFinite(s.start)) continue;
      const k = kind(s.name), end = s.start + hours(e.series, k, s.name) * 3600e3, ago = (now - end) / 60e3;
      if (!WINDOWS.some(([a, b]) => ago >= a && ago < b)) continue;
      const wf = WIRED[e.series]?.[k] || [];
      sessions.push({event: e.id, session: s.name, kind: k, endedMinAgo: Math.round(ago), run: wf});
      if (wf.length) wf.forEach(w => run.add(w)); else if (k !== 'practice' || !WIRED[e.series]) unwired.add(e.series);
    }
  }
  return {run: [...run], sessions, unwired: [...unwired]};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.find(a => a.startsWith('--now='));
  console.log(JSON.stringify(plan(arg ? new Date(arg.slice(6)) : new Date())));
}
