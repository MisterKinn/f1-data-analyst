// Locked confirmation set (AGENTS.md Gate G v3.1): every event that starts after 2026-11-23 00:00 KST, and every 2027+ event, may not be
// used as held-out data by a lap-time or physics gate. Production fits still learn from them; only judging is locked. The set is opened
// once per milestone by one run with LAPSIM_OPEN_LOCKED=1 (result in docs/gate-ledger.md).
import {calendarEvents} from '../../worker/race-calendar-data.js';
import {tiTrack} from './ti-races.mjs';

export const LOCK_FROM = Date.parse('2026-11-22T15:00:00Z'); // 2026-11-23 00:00 KST
const open = () => process.env.LAPSIM_OPEN_LOCKED === '1';
export const isLockedDate = d => !open() && Number.isFinite(Date.parse(d)) && Date.parse(d) >= LOCK_FROM;

// F1 (track id, season) → locked? A season after 2026 is locked whole; in 2026 the calendar event at that track decides.
const f1Start = {};
for (const e of calendarEvents) if (e.series === 'f1') { const y = +e.start.slice(0, 4), t = tiTrack(e.nameEn, y); if (t) (f1Start[y] ||= {})[t] = e.start; }
export function isLockedF1(track, year) {
  if (open()) return false;
  if (+year >= 2027) return true;
  const s = f1Start[+year]?.[track]; return s ? Date.parse(s) >= LOCK_FROM : false;
}
// WEC and other series: by season (2027+ locked; the 2026 WEC season ended before the lock)
export const isLockedSeason = year => !open() && +year >= 2027;
