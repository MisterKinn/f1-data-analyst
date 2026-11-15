// Driver identity across series and sources (owner 2026-11-15): the same driver is written differently ("Kevin ESTRE", "Kévin Estre",
// "K. Estre", "ESTRE Kevin", "ZHOU Guanyu" / "Guanyu Zhou", "Alex Lynn" / "Alexander Lynn", F1 three-letter codes such as VER). One id per
// person: accents, case, punctuation and word order are ignored; an initial or a short first name joins a full name only when exactly
// one known driver fits it; anything else stays separate and is reported as ambiguous, never guessed.
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ł/g, 'l')
  .toLowerCase().replace(/\b(jr|sr|ii|iii)\b\.?/g, ' ').replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
// short forms that are the same first name (only used when the surname also matches and the match is unique)
const SHORT = [['alex', 'alexander', 'alexandre', 'alessandro', 'alejandro', 'aleksander'], ['seb', 'sebastien', 'sebastian'], ['nick', 'nicky', 'nicholas', 'nicolas', 'nico', 'nicolai'],
  ['matt', 'matthew', 'mathieu', 'matthieu', 'matteo'], ['dan', 'daniel', 'danny'], ['tom', 'thomas', 'tommy'], ['will', 'william'], ['ben', 'benjamin'], ['sam', 'samuel'],
  ['chris', 'christopher', 'christian'], ['mike', 'michael', 'mikkel'], ['jon', 'jonathan', 'jonny', 'johnny'], ['rob', 'robert', 'robin'], ['fred', 'frederic', 'frederik', 'frederick'],
  ['charlie', 'charles'], ['andy', 'andrew', 'andreas', 'andrea'], ['jim', 'james', 'jamie'], ['phil', 'philip', 'philipp'], ['joe', 'joseph'], ['tony', 'antonio', 'anthony']];
const shortOf = f => SHORT.find(g => g.includes(f));
const sameFirst = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b)) || (!!shortOf(a) && shortOf(a) === shortOf(b));

// the tokens of a name with the family name found: ALLCAPS words (Al Kamel "Kevin ESTRE", "ZHOU Guanyu") are the family name
export function nameParts(raw) {
  const words = String(raw || '').trim().split(/\s+/).filter(Boolean), isCaps = w => w === w.toUpperCase() && /[A-Z]{2}/.test(w);
  const caps = words.filter(isCaps), mixed = caps.length && caps.length < words.length;
  const famW = mixed ? caps : words.slice(1), givW = mixed ? words.filter(w => !isCaps(w)) : words.slice(0, 1);
  return {given: fold(givW.join(' ')).split(' ')[0] || '', family: fold(famW.join(' ')) || fold(words[0]), key: [...new Set(fold(words.join(' ')).split(' '))].sort().join(' ')};
}

// names: [{name, series, code?}] -> {ids: Map(raw -> id), people: {id: {name, aliases, series, codes}}, ambiguous: [...]}
export function buildRegistry(names) {
  const people = {}, ids = new Map(), ambiguous = [], byKey = new Map();
  const add = (n, id) => { const p = people[id]; if (!p.aliases.includes(n.name)) p.aliases.push(n.name); if (n.series && !p.series.includes(n.series)) p.series.push(n.series); if (n.code && !p.codes.includes(n.code)) p.codes.push(n.code); ids.set(n.name, id); };
  // 1) full names first (longest given name), so initials and short forms can join them afterwards
  const sorted = [...names].sort((a, b) => nameParts(b.name).given.length - nameParts(a.name).given.length);
  for (const n of sorted) {
    const p = nameParts(n.name); if (!p.family) continue;
    if (byKey.has(p.key)) { add(n, byKey.get(p.key)); continue; }
    const cands = Object.entries(people).filter(([, q]) => q.family === p.family && sameFirst(q.given, p.given));
    if (cands.length === 1) { add(n, cands[0][0]); byKey.set(p.key, cands[0][0]); continue; }
    if (cands.length > 1) ambiguous.push({name: n.name, series: n.series, candidates: cands.map(([id]) => id)});
    const id = (p.given + '-' + p.family).replace(/\s+/g, '-');
    let u = id, k = 2; while (people[u]) u = id + '-' + k++;
    people[u] = {name: n.name, given: p.given, family: p.family, aliases: [], series: [], codes: []}; byKey.set(p.key, u); add(n, u);
  }
  return {ids, people, ambiguous};
}
