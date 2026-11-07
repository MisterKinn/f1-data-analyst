import {lapsimKernel} from './kernel.js';
// Reads the "Changes to the circuit" list in an FIA Race Director's Event/Competition Notes
// document and turns each line into a structured change the lap simulator can apply.
// Effects on grip or corner speed are scenario estimates, never measurements: the FIA notes
// say what changed, not how much faster it is. Every applied effect keeps the original line.

const HEADING = /^\s*(?:\d{1,2}(?:\.\d+)?\.?\s*\|?\s*)?((?:changes?|modifications?|alterations?)\s+(?:to\s+the\s+|since\s+(?:the\s+)?(?:last|previous)\s+\w+\s*|of\s+the\s+)?(?:circuit|track)[^\n|]*|(?:circuit|track)\s+(?:changes|modifications)[^\n|]*)$/i;
const NEXT_HEADING = /^\s*(\d{1,2})\.\s*\|?\s*[A-Z][^\n]{2,80}$/;
const BULLET = /^\s*(?:[-–•▪◦*]|\d{1,2}[).]|[a-z]\))\s*\|?\s*/;

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
    if (/raised|higher|taller|increased in height/i.test(text)) return 'kerb_raised';
    if (/reduced in height|lower(?:ed)?|removed|flatten|smaller|reduced/i.test(text)) return 'kerb_lowered';
    if (/added|install|extended|increased|new\b/i.test(text)) return 'kerb_raised';
    return 'kerb_changed';
  }
  return 'other';
}

// Finds turn references and the part of the corner each one refers to.
export function cornerRefs(text) {
  const refs = [];
  const re = /\b(?:turns?|t)\s*(\d{1,2})([a-z])?\b((?:\s*(?:,|and|&|to|until|through|-|–)\s*(?:turns?\s*|t\s*)?\d{1,2}[a-z]?\b(?!\s*(?:m\b|metres?|meters?|%)))*)/gi;
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

// "from T9 to T11", "T3-4", "between T3 and T4" are a stretch of track; "T4 and T9" or "T4, T9"
// are separate places (list).
function rangeOf(text, refs) {
  if (!refs.length) return null;
  const first = refs[0], last = refs[refs.length - 1];
  if (refs.length === 1) return {from: first, to: first, single: true};
  const stretch = /\b(?:from|until|to|through|between)\b|\d[a-z]?\s*[-–]\s*(?:turns?\s*|t\s*)?\d/i.test(text);
  if (stretch && refs.length === 2) return {from: first, to: last, single: false};
  return {from: first, to: first, single: true, list: refs};
}

// Extract the list of circuit changes from document text (pages joined with newlines).
export function extractCircuitChanges(text) {
  const lines = String(text || '').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) if (HEADING.test(lines[i])) { start = i; break; }
  if (start < 0) return {sectionFound: false, items: []};
  // the section's own number ("19. Changes to the circuit"): only a higher number ends it, so
  // items numbered "1.", "2." inside the section stay items
  const own = Number(lines[start].match(/^\s*(\d{1,2})\./)?.[1] || 0);
  const items = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i], next = line.match(NEXT_HEADING);
    if (next && (own ? Number(next[1]) > own && Number(next[1]) <= own + 2 : !BULLET.test(line))) break;
    if (/^\s*\d{1,3}\s*$/.test(line)) continue; // page number
    if (/race director\s*$/i.test(line.replace(/\s*\|\s*/g, ' '))) break; // signature block ends the list
    if (BULLET.test(line)) items.push(line.replace(BULLET, '').replace(/\s*\|\s*/g, ' ').trim());
    else if (items.length && line.trim()) items[items.length - 1] += ' ' + line.replace(/\s*\|\s*/g, ' ').trim();
  }
  return {sectionFound: true, items: items.filter(Boolean)};
}

export function parseTrackChanges(text, source = {}) {
  const {sectionFound, items} = extractCircuitChanges(text);
  // one change per sentence ("Bumps at T1 ground. New asphalt T2 to T4.")
  const sentences = items.flatMap(it => it.split(/(?<=[a-z0-9)]\.)\s+(?=[A-Z])/)).map(x => x.trim()).filter(Boolean);
  const changes = sentences.map(line => {
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

// Scenario factors and the code that applies changes live in the kernel (shared with the browser).
export const {CHANGE_EFFECTS, PART_WINDOW, windowFor, applyTrackChanges} = lapsimKernel();
