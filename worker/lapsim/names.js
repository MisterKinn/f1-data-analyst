// Display names for simulator tracks (OpenF1 circuit short-name slugs): [Korean, English].
export const TRACK_NAMES = {
  melbourne: ['앨버트 파크', 'Albert Park'], shanghai: ['상하이', 'Shanghai'], suzuka: ['스즈카', 'Suzuka'], sakhir: ['바레인', 'Bahrain'],
  jeddah: ['제다', 'Jeddah'], miami: ['마이애미', 'Miami'], montreal: ['몬트리올', 'Montreal'], 'monte-carlo': ['모나코', 'Monaco'],
  catalunya: ['바르셀로나-카탈루냐', 'Barcelona-Catalunya'], spielberg: ['레드불링', 'Red Bull Ring'], silverstone: ['실버스톤', 'Silverstone'],
  'spa-francorchamps': ['스파-프랑코르샹', 'Spa-Francorchamps'], hungaroring: ['헝가로링', 'Hungaroring'], zandvoort: ['잔드보르트', 'Zandvoort'],
  monza: ['몬자', 'Monza'], madring: ['마드리드', 'Madrid'], baku: ['바쿠', 'Baku'], singapore: ['싱가포르', 'Singapore'], austin: ['COTA (오스틴)', 'COTA (Austin)'],
  'mexico-city': ['멕시코시티', 'Mexico City'], interlagos: ['인터라고스', 'Interlagos'], 'las-vegas': ['라스베이거스', 'Las Vegas'],
  lusail: ['루사일', 'Lusail'], 'kuala-lumpur': ['세팡', 'Sepang'], 'yas-marina-circuit': ['야스 마리나', 'Yas Marina'], imola: ['이몰라', 'Imola'],
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
  'kuala-lumpur': 'Bahrain Grand Prix', // 2026: the Bahrain GP was held at Sepang (4 October)
};

// FIA event for a track in a given season (null when that event ran elsewhere that year)
export function eventFor(id, year) {
  if (id === 'kuala-lumpur') return year === 2026 ? TRACK_EVENTS[id] : null;
  if (id === 'sakhir' && year === 2026) return null;
  return TRACK_EVENTS[id] || null;
}

const ALIASES = {cota: 'austin', 'circuit of the americas': 'austin', usa: 'austin', 'united states': 'austin', austin: 'austin', vegas: 'las-vegas',
  madrid: 'madring', spain: 'madring', spanish: 'madring', brazil: 'interlagos', 'sao paulo': 'interlagos', 'abu dhabi': 'yas-marina-circuit', yas: 'yas-marina-circuit',
  austria: 'spielberg', britain: 'silverstone', british: 'silverstone', 'united kingdom': 'silverstone', uk: 'silverstone', 'great britain': 'silverstone',
  japan: 'suzuka', china: 'shanghai', australia: 'melbourne', canada: 'montreal', 'gilles villeneuve': 'montreal',
  italy: 'monza', belgium: 'spa-francorchamps', spa: 'spa-francorchamps', hungary: 'hungaroring', netherlands: 'zandvoort', dutch: 'zandvoort',
  bahrain: 'sakhir', saudi: 'jeddah', qatar: 'lusail', azerbaijan: 'baku', mexico: 'mexico-city', 'hermanos rodriguez': 'mexico-city',
  barcelona: 'catalunya', 'emilia romagna': 'imola', 'marina bay': 'singapore', sepang: 'kuala-lumpur', malaysia: 'kuala-lumpur', 'albert park': 'melbourne', monaco: 'monte-carlo'};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/grand prix|\bgp\b|circuit\b(?! of)/g, ' ').replace(/[^a-z0-9가-힣]+/g, ' ').trim();
const words = q => ` ${q} `;
const ALIAS_KEYS = Object.entries(ALIASES).map(([k, v]) => [norm(k), v]);

// Track id from an id, Korean/English name, event name or common alias; null when nothing matches.
export function resolveTrack(query, ids) {
  const q = norm(query);
  if (q.length < 2) return null;
  const keys = id => [id.replace(/-/g, ' '), ...(TRACK_NAMES[id] || []), TRACK_EVENTS[id] || ''].map(norm).filter(Boolean);
  // 1) exact name, 2) alias as whole words, 3) query is a whole-word part of a name (3+ letters)
  const exact = ids.find(id => keys(id).includes(q)) || ALIAS_KEYS.find(([k, v]) => k === q && ids.includes(v))?.[1];
  if (exact) return exact;
  const alias = ALIAS_KEYS.filter(([k, v]) => words(q).includes(words(k)) && ids.includes(v)).sort((a, b) => b[0].length - a[0].length)[0];
  if (alias) return alias[1];
  if (q.length < 3) return null;
  return ids.find(id => keys(id).some(k => words(k).includes(words(q)) || words(q).includes(words(k)))) || null;
}
