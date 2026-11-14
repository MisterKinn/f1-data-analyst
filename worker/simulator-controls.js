// Lap simulator page controls (display only, no physics): track list labels, the Evo tick box
// rule and the event a car races at on a track. Nothing here changes a model or calibration value.
import {calendarEvents} from './race-calendar-data.js';
import {lapsimLearned} from './lapsim/learned-data.js';

// Track labels in the owner's format: 3-letter code + " - " + name (no flag, owner 2026-11-14). [ISO country, code, name, always ⚠️].
// The codes are the owner's (Bahrain is BHA). Requested tracks come from scripts/sim/data/track-requests.json
// (owner list, 2026-11-11); a track is listed on the page only when it exists in tracks-data.js.
const L = {
  melbourne: ['AU', 'AUS', 'Melbourne'], bathurst: ['AU', 'AUS', 'Bathurst'], spielberg: ['AT', 'AUT', 'Red Bull Ring'], baku: ['AZ', 'AZE', 'Baku'],
  'spa-francorchamps': ['BE', 'BEL', 'Spa'], sakhir: ['BH', 'BHA', 'Bahrain'], 'sakhir-outer': ['BH', 'BHA', 'Bahrain(Outer)'],
  interlagos: ['BR', 'BRA', 'Interlagos'], 'fe-sao-paulo': ['BR', 'BRA', 'São Paulo Anhembi'], montreal: ['CA', 'CAN', 'Montreal'], mosport: ['CA', 'CAN', 'Mosport'],
  shanghai: ['CN', 'CHN', 'Shanghai'], 'fe-sanya': ['CN', 'CHN', 'Sanya Haitang Bay'], catalunya: ['ES', 'ESP', 'Barcelona'], madring: ['ES', 'ESP', 'Madrid'], jarama: ['ES', 'ESP', 'Jarama'],
  'le-mans': ['FR', 'FRA', 'Le Mans'], 'paul-ricard': ['FR', 'FRA', 'Paul Ricard'], 'paul-ricard-f1': ['FR', 'FRA', 'Paul Ricard(F1)'], silverstone: ['GB', 'GBR', 'Silverstone'], 'brands-hatch': ['GB', 'GBR', 'Brands Hatch'],
  nurburgring: ['DE', 'GER', 'Nürburgring'], 'nurburgring-gp': ['DE', 'GER', 'Nürburgring GP'], 'nurburgring-sprint': ['DE', 'GER', 'Nürburgring Sprint'], 'nurburgring-24h': ['DE', 'GER', 'Nürburgring 24h'], hockenheim: ['DE', 'GER', 'Hockenheim'], 'fe-berlin': ['DE', 'GER', 'Berlin Tempelhof'], hungaroring: ['HU', 'HUN', 'Hungaroring'],
  monza: ['IT', 'ITA', 'Monza'], mugello: ['IT', 'ITA', 'Mugello'], imola: ['IT', 'ITA', 'Imola'], suzuka: ['JP', 'JPN', 'Suzuka'], fuji: ['JP', 'JPN', 'Fuji'], 'fe-tokyo': ['JP', 'JPN', 'Tokyo'],
  yeongam: ['KR', 'KOR', 'Yeongam'], yongin: ['KR', 'KOR', 'Yongin'], inje: ['KR', 'KOR', 'Inje'], jeddah: ['SA', 'KSA', 'Jeddah'], 'kuala-lumpur': ['MY', 'MAS', 'Sepang'],
  'mexico-city': ['MX', 'MEX', 'Mexico City'], 'monte-carlo': ['MC', 'MON', 'Monaco'], zandvoort: ['NL', 'NED', 'Zandvoort'], portimao: ['PT', 'POR', 'Portimão'],
  lusail: ['QA', 'QAT', 'Lusail'], kyalami: ['ZA', 'RSA', 'Kyalami'], rwanda: ['RW', 'RWA', 'Rwanda', true], singapore: ['SG', 'SGP', 'Singapore'],
  'yas-marina-circuit': ['AE', 'UAE', 'Yas Marina'], austin: ['US', 'USA', 'COTA'], indianapolis: ['US', 'USA', 'Indianapolis'], 'las-vegas': ['US', 'USA', 'Las Vegas'],
  sebring: ['US', 'USA', 'Sebring'], 'road-atlanta': ['US', 'USA', 'Road Atlanta'], miami: ['US', 'USA', 'Miami'], daytona: ['US', 'USA', 'Daytona'],
  'laguna-seca': ['US', 'USA', 'Laguna Seca'], 'watkins-glen': ['US', 'USA', 'Watkins Glen'], 'road-america': ['US', 'USA', 'Road America'], 'long-beach': ['US', 'USA', 'Long Beach'],
  detroit: ['US', 'USA', 'Detroit'], vir: ['US', 'USA', 'VIR'], 'mid-ohio': ['US', 'USA', 'Mid-Ohio'], 'lime-rock': ['US', 'USA', 'Lime Rock'],
};
const WARN = '⚠️';

// ⚠️ = lower evidence. An extra circuit carries its check result (fit: false = failed or not checkable, docs/lapsim-tracks-extra.md);
// a track without a check result is a candidate when it was built from a map centre line.
export const isCandidate = track => !!track && (track.candidate === true || (typeof track.fit === 'boolean' ? !track.fit : (track.sources || []).some(s => /openstreetmap/i.test(s))));

// Owner rule (2026-11-14): a track is published unless its error is really bad; ⚠️ marks a track that is not built yet (Rwanda),
// has no real lap to check, or has a larger error. Where the learning step has real laps of this track (docs/lapsim-learn.md),
// its error with one event hidden decides: above WARN_PCT in any class = ⚠️, whatever the older single-factor check said.
export const WARN_PCT = 3;
export function trackWarn(id, track) {
  if (L[id]?.[3]) return true;
  const e = Object.values(lapsimLearned?.tracks?.[id]?.errPct || {}); if (e.length) return Math.max(...e) > WARN_PCT;
  return isCandidate(track);
}

// "ITA - Monza"; a track with no label entry keeps its plain data name (no invented code)
export function trackLabel(id, track) {
  const e = L[id], w = trackWarn(id, track) ? WARN : ''; if (!e) return (track?.name || id) + w;
  return e[1] + ' - ' + e[2] + w;
}

// Track ids sorted by the 3-letter code, then by name (unlabelled tracks last, by name)
export function trackOrder(tracks) {
  const key = id => L[id] ? [L[id][1], L[id][2]] : ['~', tracks[id]?.name || id];
  return Object.keys(tracks).sort((a, b) => { const [ca, na] = key(a), [cb, nb] = key(b); return ca < cb ? -1 : ca > cb ? 1 : na.localeCompare(nb, 'en'); });
}

// Evo tick box: base car key → key of its Evo entry. An Evo entry is a car of the same series, class and base
// model whose data carries an `evo` kit mark; with no such entry there is no pair (the box stays disabled).
export function evoPairs(cars, order = Object.keys(cars)) {
  const out = {}, same = (a, b) => a.base === b.base && (a.series || 'f1') === (b.series || 'f1') && a.cls === b.cls;
  for (const k of order) { const c = cars[k]; if (!c?.base || c.evo) continue;
    const e = order.filter(j => cars[j]?.evo && same(cars[j], c)).sort((a, b) => String(cars[a].evo).localeCompare(String(cars[b].evo)))[0];
    if (e) out[k] = e; }
  return out;
}

// Calendar circuit ids that differ from the simulator track ids
const CIRCUIT = {'albert-park': 'melbourne', spa: 'spa-francorchamps', cota: 'austin', mexico: 'mexico-city', barcelona: 'catalunya', 'red-bull-ring': 'spielberg',
  madrid: 'madring', sepang: 'kuala-lumpur', monaco: 'monte-carlo', bahrain: 'sakhir', 'yas-marina': 'yas-marina-circuit'};

// The event this car races at on this track (F1 car → the Grand Prix, WEC car → the WEC race), from the
// calendar data, with the season of the session weather the page already uses for that car. Null when the
// calendar has no such event or the data has no session weather of this car here: then nothing new is shown.
export function carEvent(trackId, carKey, car, conds, events = calendarEvents) {
  if (!car || car.kind === 'base') return null;
  const own = conds?.[car.series ? carKey : String(car.year)]; if (!own) return null;
  const weatherYear = Number(own.year ?? car.year), series = car.series || 'f1';
  const at = events.filter(e => e.series === series && (CIRCUIT[e.circuit] || e.circuit) === trackId);
  if (!at.length || !Number.isFinite(weatherYear)) return null;
  const gap = e => Math.abs(Number(e.start.slice(0, 4)) - weatherYear);
  const e = at.sort((a, b) => gap(a) - gap(b) || b.start.localeCompare(a.start))[0];
  return {name: e.name, nameEn: e.nameEn, start: e.start, end: e.end, weatherYear};
}
