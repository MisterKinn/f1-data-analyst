// ELMS LMGT3 BoP tables from the notice-board text (scripts/sim/data/learn/elms-bop-docs, fetch-elms-bop-docs.mjs) into
// scripts/sim/data/elms-lmgt3-bop.json, same shape as wec-lmgt3-bop.json: per car [power curve, power gain after 200 kph %, min weight kg, MJ].
// An amended decision replaces the original of the same event. A decision posted without its table (ELMS 2026 from Spa on) is listed
// under "unpublished": those events are the ones the simulator estimates.
//   node scripts/sim/learn/parse-elms-bop.mjs
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';

const DIR = 'scripts/sim/data/learn/elms-bop-docs';
const EV = [[/_BARC?_/, 'BARCELONA'], [/_CAST?_/, 'PAULRICARD'], [/_IMOL?A?_/, 'IMOLA'], [/_SPA/, 'SPA'], [/_MUGE_/, 'MUGELLO'], [/_PORT?_|_POR_/, 'PORTIMAO'], [/_SIL_/, 'SILVERSTONE']];
const MAKE = [[/^ASTON/, 'AstonMartin'], [/^CORVETTE/, 'Corvette'], [/^FERRARI/, 'Ferrari'], [/^MC ?LAREN/, 'McLaren'], [/^MERCEDES/, 'Mercedes'], [/^PORSCHE/, 'Porsche'], [/^LAMBORGHINI/, 'Lamborghini'], [/^BMW/, 'BMW'], [/^FORD/, 'Ford'], [/^LEXUS/, 'Lexus']];
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')), url = Object.fromEntries(index.files.map(f => [f.base, f.url]));
const events = {}, unpublished = [];
for (const season of readdirSync(DIR).filter(d => /^\d+_\d{4}$/.test(d)).sort()) {
  const year = season.slice(-4);
  for (const f of readdirSync(`${DIR}/${season}`).filter(x => x.endsWith('.txt')).sort()) {
    const base = f.replace(/\.txt$/, ''), ev = (EV.find(([re]) => re.test(base.toUpperCase() + '_')) || [])[1]; if (!ev) continue;
    const cars = {};
    for (const raw of readFileSync(`${DIR}/${season}/${f}`, 'utf8').split('\n')) {
      const l = raw.replace(/\s+/g, ' ').trim(), mk = (MAKE.find(([re]) => re.test(l)) || [])[1]; if (!mk || !/P\d/.test(l)) continue;
      const curve = +/\bP(\d+(?:\.\d+)?)\b/.exec(l)[1], after = l.slice(l.search(/\bP\d/));
      const pcts = [...after.matchAll(/(-?\d+(?:[.,]\d+)?)%/g)].map(m => +m[1].replace(',', '.')), kg = [...after.matchAll(/\b(1[23]\d\d)\b/g)].map(m => +m[1]).at(-1);
      const nums = l.match(/-?\d+(?:\.\d+)?/g), MJ = +nums.at(-1);
      if (pcts.length) cars[mk] = [curve, pcts.at(-1), kg ?? null, MJ];
    }
    const key = `${year} ${ev}`, amended = /amended/i.test(base);
    if (!Object.keys(cars).length) { if (!events[key]) unpublished.push({event: key, doc: base, url: url[base]}); continue; }
    if (!events[key] || amended) events[key] = {doc: base, url: url[base], cars};
  }
}
for (const u of [...unpublished]) if (events[u.event]) unpublished.splice(unpublished.indexOf(u), 1);
writeFileSync('scripts/sim/data/elms-lmgt3-bop.json', JSON.stringify({note: 'ELMS LMGT3 BoP decisions (ELMS notice board). Per car: [power curve, power gain after 200 kph (%), min weight without success ballast (kg, null when the table has no weight column), max stint energy (MJ)]. Built by scripts/sim/learn/parse-elms-bop.mjs.', events, unpublished}, null, 1));
console.log(Object.entries(events).map(([k, v]) => `${k}: ${Object.keys(v.cars).length} cars${Object.values(v.cars).some(c => c[2] == null) ? ' (no kg)' : ''}`).join(' | '));
console.log('unpublished', unpublished.map(u => u.event).join(', '));
