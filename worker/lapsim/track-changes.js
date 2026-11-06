// Reads the "Changes to the circuit" list in an FIA Race Director's Event/Competition Notes
// document and turns each line into a structured change the lap simulator can apply.
// Effects on grip or corner speed are scenario estimates, never measurements: the FIA notes
// say what changed, not how much faster it is. Every applied effect keeps the original line.

const HEADING = /^\s*(?:\d{1,2}(?:\.\d+)?\.?\s*\|?\s*)?((?:changes?|modifications?|alterations?)\s+(?:to\s+the\s+|since\s+(?:the\s+)?(?:last|previous)\s+\w+\s*|of\s+the\s+)?(?:circuit|track)[^\n|]*|(?:circuit|track)\s+(?:changes|modifications)[^\n|]*)$/i;
const NEXT_HEADING = /^\s*\d{1,2}\.\s*\|?\s*[A-Z][^\n]{2,80}$/;
const BULLET = /^\s*(?:[-–•▪◦*]|\d{1,2}\)|[a-z]\))\s*\|?\s*/;

// Default scenario factors. Kept small and explicit; the page shows them next to each change.
export const CHANGE_EFFECTS = {
  resurfacing: {kind: 'grip', factor: 1.02, ko: '새 노면: 그립 +2% 가정', en: 'New surface: +2% grip assumed'},
  bump_removal: {kind: 'grip', factor: 1.01, ko: '범프 제거: 그립 +1% 가정', en: 'Bump removed: +1% grip assumed'},
  kerb_lowered: {kind: 'cornerSpeed', factor: 1.005, ko: '연석 낮춤: 코너 속도 +0.5% 가정', en: 'Lower kerb: +0.5% corner speed assumed'},
  kerb_raised: {kind: 'cornerSpeed', factor: 0.995, ko: '연석 높임·추가: 코너 속도 −0.5% 가정', en: 'Higher or added kerb: −0.5% corner speed assumed'},
};

const RULES = [
  ['track_limits', /\b(?:paint|white line|blue line|track[- ]limit|detection loop)/i],
  ['resurfacing', /\bre-?surfac|new asphalt|re-?laid|re-?asphalt|new (?:track )?surface|surface (?:has been |was )?(?:replaced|renewed)/i],
  ['bump_removal', /\bbump|smooth(?:ed|ing)?\b|grind|diamond[- ]cut/i],
  ['kerb', /\bkerb|\bcurb|sausage|rumble strip/i],
  ['layout', /re-?profil|\blayout|chicane|realign|widen|narrow(?:ed|ing)|new corner|corner (?:has been |was )?(?:modified|changed|moved)|apex (?:has been |was )?moved/i],
  ['runoff', /gravel|run-?off|grass|astro ?turf|artificial turf/i],
  ['drainage', /drain/i],
  ['pit', /\bpit (?:lane|entry|exit|wall|building)/i],
  ['infrastructure', /barrier|tecpro|debris fence|fence|light panel|display|hospitality|grandstand|cable car|bridge|marshal|camera|building|tyre wall|guard ?rail|\bwall\b|screen|signage|post/i],
];

export function classifyChange(text) {
  for (const [type, re] of RULES) if (re.test(text)) {
    if (type !== 'kerb') return type;
    if (/reduced in height|lower(?:ed)?|removed|flatten|smaller|reduced/i.test(text)) return 'kerb_lowered';
    if (/raised|higher|added|install|extended|increased|new\b/i.test(text)) return 'kerb_raised';
    return 'kerb_changed';
  }
  return 'other';
}

// Finds turn references and the part of the corner each one refers to.
export function cornerRefs(text) {
  const refs = [];
  const re = /\b(?:turns?|t)\s*(\d{1,2})([a-z])?\b((?:\s*(?:,|and|&|to|until|-|–)\s*(?:turns?\s*|t\s*)?\d{1,2}[a-z]?\b)*)/gi;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 28), m.index).toLowerCase();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 14).toLowerCase();
    const part = /approach/.test(before) ? 'approach' : /entr(?:y|ance)/.test(before) ? 'entry' : /\bexit/.test(before) ? 'exit'
      : /apex/.test(before) ? 'apex' : /after/.test(before) ? 'after' : /before/.test(before) ? 'approach'
      : /^\s*apex/.test(after) ? 'apex' : /^\s*(?:entry|entrance)/.test(after) ? 'entry' : /^\s*exit/.test(after) ? 'exit' : null;
    refs.push({turn: Number(m[1]), letter: m[2] ? m[2].toUpperCase() : '', part, index: m.index});
    for (const extra of (m[3] || '').matchAll(/(\d{1,2})([a-z])?/gi)) refs.push({turn: Number(extra[1]), letter: extra[2] ? extra[2].toUpperCase() : '', part: null, index: m.index + 1});
  }
  return refs;
}

function rangeOf(text, refs) {
  if (!refs.length) return null;
  const isRange = refs.length > 1 && /\b(?:from|until|to|between|and|-|–)\b|\d\s*[-–]\s*\d/i.test(text);
  const first = refs[0], last = refs[refs.length - 1];
  if (!isRange) return {from: first, to: first, single: true};
  return {from: first, to: last, single: false};
}

// Extract the list of circuit changes from document text (pages joined with newlines).
export function extractCircuitChanges(text) {
  const lines = String(text || '').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) if (HEADING.test(lines[i])) { start = i; break; }
  if (start < 0) return {sectionFound: false, items: []};
  const items = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (NEXT_HEADING.test(line) && !BULLET.test(line)) break;
    if (/^\s*\d{1,3}\s*$/.test(line)) continue; // page number
    if (BULLET.test(line)) items.push(line.replace(BULLET, '').replace(/\s*\|\s*/g, ' ').trim());
    else if (items.length && line.trim()) items[items.length - 1] += ' ' + line.replace(/\s*\|\s*/g, ' ').trim();
  }
  return {sectionFound: true, items: items.filter(Boolean)};
}

export function parseTrackChanges(text, source = {}) {
  const {sectionFound, items} = extractCircuitChanges(text);
  const changes = items.map(line => {
    const type = classifyChange(line);
    const refs = cornerRefs(line);
    const range = rangeOf(line, refs);
    const effect = CHANGE_EFFECTS[type] || null;
    return {
      text: line, type, range,
      corners: [...new Set(refs.map(r => r.turn + r.letter))],
      affectsLap: !!effect && !!range,
      needsGeometry: type === 'layout',
      effect: effect && range ? {kind: effect.kind, factor: effect.factor, ko: effect.ko, en: effect.en, scenario: true} : null,
      source,
    };
  });
  return {sectionFound, changes};
}

// Distance window (m) along the lap for a corner reference, from corner apex distances.
const PART_WINDOW = {approach: [-250, -30], entry: [-90, -10], apex: [-30, 30], exit: [10, 90], after: [30, 200], null: [-80, 80]};
function windowFor(ref, corners) {
  const c = corners.find(x => x.number === ref.turn && (x.letter || '') === (ref.letter || ''))
    || corners.find(x => x.number === ref.turn);
  if (!c) return null;
  const w = PART_WINDOW[ref.part] || PART_WINDOW.null;
  return [c.s + w[0], c.s + w[1]];
}

// Apply parsed changes to a track (mu / vScale arrays). corners: [{number, letter, s}] with s in metres.
// strength scales every scenario effect (0 = ignore, 1 = default, 2 = double).
export function applyTrackChanges(track, changes, corners, {strength = 1} = {}) {
  const n = track.kappa.length, L = n * track.ds;
  const mu = Float64Array.from(track.mu || new Float64Array(n).fill(1));
  const vScale = Float64Array.from(track.vScale || new Float64Array(n).fill(1));
  const applied = [];
  for (const ch of changes) {
    if (!ch.affectsLap || !ch.effect || !corners?.length) continue;
    const a = windowFor(ch.range.from, corners), b = windowFor(ch.range.to, corners);
    if (!a || !b) { applied.push({...ch, applied: false, reason: 'corner not found'}); continue; }
    let s0 = ch.range.single ? a[0] : a[0], s1 = ch.range.single ? a[1] : b[1];
    if (ch.range.from.part === 'entry' && ch.range.to.part === 'entry' && !ch.range.single) s1 = b[0];
    s0 = ((s0 % L) + L) % L; s1 = ((s1 % L) + L) % L;
    const factor = 1 + (ch.effect.factor - 1) * strength;
    const target = ch.effect.kind === 'grip' ? mu : vScale;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const s = i * track.ds;
      const inside = s0 <= s1 ? (s >= s0 && s <= s1) : (s >= s0 || s <= s1);
      if (inside) { target[i] *= factor; count++; }
    }
    applied.push({...ch, applied: count > 0, sStart: s0, sEnd: s1, points: count, factor});
  }
  return {track: {...track, mu, vScale}, applied};
}
