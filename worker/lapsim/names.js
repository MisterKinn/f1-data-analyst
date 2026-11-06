// Display names for simulator tracks (OpenF1 circuit short-name slugs): [Korean, English].
export const TRACK_NAMES = {
  melbourne: ['앨버트 파크', 'Albert Park'], shanghai: ['상하이', 'Shanghai'], suzuka: ['스즈카', 'Suzuka'], sakhir: ['바레인', 'Bahrain'],
  jeddah: ['제다', 'Jeddah'], miami: ['마이애미', 'Miami'], montreal: ['몬트리올', 'Montreal'], 'monte-carlo': ['모나코', 'Monaco'],
  catalunya: ['바르셀로나-카탈루냐', 'Barcelona-Catalunya'], spielberg: ['레드불링', 'Red Bull Ring'], silverstone: ['실버스톤', 'Silverstone'],
  'spa-francorchamps': ['스파-프랑코르샹', 'Spa-Francorchamps'], hungaroring: ['헝가로링', 'Hungaroring'], zandvoort: ['잔드보르트', 'Zandvoort'],
  monza: ['몬자', 'Monza'], madring: ['마드리드', 'Madrid'], baku: ['바쿠', 'Baku'], singapore: ['싱가포르', 'Singapore'], austin: ['COTA (오스틴)', 'COTA (Austin)'],
  'mexico-city': ['멕시코시티', 'Mexico City'], interlagos: ['인터라고스', 'Interlagos'], 'las-vegas': ['라스베이거스', 'Las Vegas'],
  lusail: ['루사일', 'Lusail'], 'yas-marina-circuit': ['야스 마리나', 'Yas Marina'], imola: ['이몰라', 'Imola'],
};

// FIA event name for each track (used to find the race director's notes).
export const TRACK_EVENTS = {
  melbourne: 'Australian Grand Prix', shanghai: 'Chinese Grand Prix', suzuka: 'Japanese Grand Prix', sakhir: 'Bahrain Grand Prix',
  jeddah: 'Saudi Arabian Grand Prix', miami: 'Miami Grand Prix', montreal: 'Canadian Grand Prix', 'monte-carlo': 'Monaco Grand Prix',
  catalunya: 'Barcelona-Catalunya Grand Prix', spielberg: 'Austrian Grand Prix', silverstone: 'British Grand Prix',
  'spa-francorchamps': 'Belgian Grand Prix', hungaroring: 'Hungarian Grand Prix', zandvoort: 'Dutch Grand Prix', monza: 'Italian Grand Prix',
  madring: 'Spanish Grand Prix', baku: 'Azerbaijan Grand Prix', singapore: 'Singapore Grand Prix', austin: 'United States Grand Prix',
  'mexico-city': 'Mexico City Grand Prix', interlagos: 'São Paulo Grand Prix', 'las-vegas': 'Las Vegas Grand Prix', lusail: 'Qatar Grand Prix',
  'yas-marina-circuit': 'Abu Dhabi Grand Prix', imola: 'Emilia Romagna Grand Prix',
};

const ALIASES = {cota: 'austin', 'circuit of the americas': 'austin', usa: 'austin', 'united states': 'austin', vegas: 'las-vegas',
  madrid: 'madring', brazil: 'interlagos', 'abu dhabi': 'yas-marina-circuit', yas: 'yas-marina-circuit', austria: 'spielberg',
  britain: 'silverstone', uk: 'silverstone', japan: 'suzuka', china: 'shanghai', australia: 'melbourne', canada: 'montreal',
  italy: 'monza', belgium: 'spa-francorchamps', spa: 'spa-francorchamps', hungary: 'hungaroring', netherlands: 'zandvoort', dutch: 'zandvoort',
  bahrain: 'sakhir', saudi: 'jeddah', qatar: 'lusail', azerbaijan: 'baku', mexico: 'mexico-city', barcelona: 'catalunya', 'emilia romagna': 'imola'};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/grand prix|\bgp\b|circuit/g, ' ').replace(/[^a-z0-9가-힣]+/g, ' ').trim();

// Track id from an id, Korean/English name, event name or common alias; null when nothing matches.
export function resolveTrack(query, ids) {
  const q = norm(query);
  if (!q) return null;
  const keys = id => [id, ...(TRACK_NAMES[id] || []), TRACK_EVENTS[id] || ''].map(norm).filter(Boolean);
  const exact = ids.find(id => keys(id).includes(q)) || (ALIASES[q] && ids.includes(ALIASES[q]) ? ALIASES[q] : null);
  if (exact) return exact;
  const alias = Object.keys(ALIASES).find(a => q.includes(a) && ids.includes(ALIASES[a]));
  return ids.find(id => keys(id).some(k => k.includes(q) || q.includes(k))) || (alias ? ALIASES[alias] : null);
}
