// Same driver under another spelling (task P1e): an entry list and the FIA public list do not always write a name the same way
// ("Dani Juncadella" / "Daniel Juncadella", "Alessandro Pierguidi" / "Alessandro Pier Guidi", "Albert Costa" / "Albert Costa Balboa").
// A variant counts only when exactly ONE driver of that FIA list fits, by one of three fixed rules:
//   join     - one token is two tokens of the other name written together, the rest equal
//   subset   - all tokens of the shorter name (at least two) are in the longer one
//   short    - the first names are a short form and its full form of this table, the rest equal
//   umlaut   - "Götz" written "Goetz" (variantIn, with the written names)
//   initial  - a first initial and the full first name (Natsoft result sheets: "C.Mostert"), the rest equal
// No similarity score, no spelling correction ("Denis" / "Dennis" is not joined): a rating never moves to another person.
// Used by fetch-sro-lineups.mjs (which list rows to keep) and build-driver-ratings.mjs (rating of a driver with no exact name).
export const tokens = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(\w)['’](\w)/g, '$1$2').replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean); // "D'Alberto" is one word
const SHORT = {alex: ['alexander', 'alexandre', 'alessandro', 'alejandro', 'alexis', 'alexey', 'aleksandr'], chris: ['christopher', 'christian', 'christoph', 'christophe'],
  dani: ['daniel'], dan: ['daniel'], danny: ['daniel'], nick: ['nicholas', 'nicolas', 'nicola', 'niklas', 'nicolai', 'nikolaj', 'nicky'], matt: ['matthew', 'mathew', 'matthias', 'matteo'],
  maxi: ['maximilian', 'maxime', 'maximiliano'], max: ['maximilian', 'maxime', 'maximiliano'], seb: ['sebastian', 'sebastien'], tom: ['thomas', 'tommaso'], tommy: ['thomas'],
  dave: ['david'], jeff: ['jeffrey', 'jeffery'], zach: ['zachary'], mike: ['michael', 'mikael'], ben: ['benjamin'], sam: ['samuel'], joe: ['joseph'], rob: ['robert'],
  andy: ['andrew', 'andreas'], jon: ['jonathan'], josh: ['joshua'], phil: ['philip', 'philipp', 'phillip'], tim: ['timothy'], will: ['william'], fred: ['frederick', 'frederik'],
  freddie: ['frederick', 'frederik'], jim: ['james'], jimmy: ['james'], johnny: ['john'], toni: ['anton', 'antonio'], tony: ['anthony', 'antonio'], ed: ['edward'], ted: ['edward'],
  greg: ['gregory', 'gregor'], steve: ['steven', 'stephen'], rick: ['richard'], ricky: ['richard'], charlie: ['charles'], harry: ['henry', 'harrison'], kenny: ['kenneth'],
  manu: ['manuel', 'emmanuel'], jonny: ['jonathan', 'john'], bob: ['robert'], leo: ['leonardo', 'leon'], nico: ['nicolas', 'nicolai', 'niklas', 'nicola'], gabi: ['gabriel', 'gabriele'], beni: ['benjamin']};
const short = (a, b) => (SHORT[a] || []).includes(b) || (SHORT[b] || []).includes(a);
export function sameDriver(a, b) { // a, b: token arrays
  const A = [...a], B = [...b]; if (A.join(' ') === B.join(' ')) return 'exact';
  const sa = [...A].sort().join(' '), sb = [...B].sort().join(' '); if (sa === sb) return 'exact';
  for (const [x, y] of [[A, B], [B, A]]) for (let i = 0; i < y.length; i++) for (let j = 0; j < y.length; j++) if (i !== j) { // join
    const glued = y[i] + y[j], rest = y.filter((_, k) => k !== i && k !== j); if (x.includes(glued) && x.length === rest.length + 1 && rest.every(t => x.includes(t))) return 'join'; }
  const [s, l] = A.length <= B.length ? [A, B] : [B, A]; if (s.length >= 2 && s.length < l.length && s.every(t => l.includes(t))) return 'subset';
  if (A.length === B.length && A.length >= 2) for (const t of A) { const u = B.find(v => !A.includes(v)); const rest = A.filter(v => v !== t);
    if (u && !B.includes(t) && short(t, u) && rest.every(v => B.includes(v)) && B.filter(v => v !== u).every(v => A.includes(v))) return 'short'; }
  // initial: "C. Mostert" (Natsoft result sheets print first initials) and "Chaz Mostert": the same surname tokens, the initial is the
  // first letter of the one first name
  for (const [x, y] of [[A, B], [B, A]]) { const i = x.findIndex(t => t.length === 1); if (i < 0 || x.filter(t => t.length === 1).length > 1) continue;
    const rest = x.filter((_, k) => k !== i); if (y.length === rest.length + 1 && rest.every(t => y.includes(t))) { const f = y.find(t => !rest.includes(t)); if (f && f.length > 1 && f[0] === x[i]) return 'initial'; } }
  return null;
}
// index of the one row of `rows` (token arrays) that is the same driver as `name`; -1 when none or more than one fit
// German spelling of an umlaut: "Götz" = "Goetz" (and "Gotz", the umlaut dropped). Needs the written names, not the folded tokens.
export const tokensDE = s => tokens(String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue'));
const key = t => [...t].sort().join(' ');
export function variantIn(name, rows, byToken, raws) {
  const t = tokens(name); if (t.length < 2) return {i: -1};
  if (raws) { const a = key(tokensDE(name)), b = key(t); // umlaut: one fitting row only, the same words once the umlaut is spelt out
    const u = raws.map((r, i) => r && (key(tokensDE(r)) === b || key(tokens(r)) === a) && key(rows[i]) !== b ? i : -1).filter(i => i >= 0);
    if (u.length === 1) return {i: u[0], rule: 'umlaut'}; if (u.length > 1) return {i: -1, n: u.length}; }
  const cand = new Set(); for (const w of [...t, ...t.flatMap(x => SHORT[x] || []), ...Object.keys(SHORT).filter(k => SHORT[k].some(v => t.includes(v)))]) for (const i of byToken.get(w) || []) cand.add(i);
  for (const i of [...byToken.keys()].filter(k => t.some(x => x.length > 4 && x.startsWith(k) && x !== k)).flatMap(k => byToken.get(k))) cand.add(i); // "pierguidi" -> "pier"
  const hits = [...cand].map(i => [i, sameDriver(t, rows[i])]).filter(([, r]) => r && r !== 'exact');
  return hits.length === 1 ? {i: hits[0][0], rule: hits[0][1]} : {i: -1, n: hits.length};
}
export const tokenIndex = rows => { const m = new Map(); rows.forEach((r, i) => { for (const w of r) (m.get(w) || m.set(w, []).get(w)).push(i); }); return m; };
