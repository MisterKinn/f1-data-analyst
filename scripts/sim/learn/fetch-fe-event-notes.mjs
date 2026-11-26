// FE Attack Mode per race from the FIA "Event Note – Race Information" documents on the official FE noticeboard (Seasons 9–12).
// Needs network (Actions). Keeps only parsed facts (numbers + the document URL); no PDF and no text is stored. Out: fe-event-notes.json.
//   node scripts/sim/learn/fetch-fe-event-notes.mjs [--selftest]
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const IDX = 'https://d112sbqg9gqc2x.cloudfront.net/', FILES = 'https://results.formulae.fia.com', SEASONS = new RegExp(process.env.FE_SEASONS || 'Season (9|10|11|12) ');
const num = s => s == null ? null : +String(s).replace(',', '.');
export function parseNote(text) { // facts from one Race Information note
  const t = text.replace(/\s+/g, ' '), m = (re, f = num) => { const x = t.match(re); return x ? f(x[1]) : null; };
  const am = t.match(/ATTACK MODE[^]*?(?=PIT BOOST|ENERGY|$)/i)?.[0] || t;
  const g = (re, src = am) => { const x = src.match(re); return x ? num(x[1]) : null; };
  const docDate = t.match(/Date:?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null, rounds = [...new Set([...t.matchAll(/\bR(\d{2})\b|Round\s*(\d{1,2})\b/gi)].map(x => +(x[1] || x[2])))];
  const raceTag = [...new Set([...t.matchAll(/\b(Race\s*[12]|Saturday|Sunday)\b/gi)].map(x => x[1].replace(/\s+/g, ' ').toLowerCase()))];
  return {docDate, roundsNamed: rounds, raceTag, amKW: g(/(\d{3})\s*kW\s*Power Mode/i), amTimeS: g(/Power Mode time:?\s*(\d+)\s*seconds/i) ?? (g(/Power Mode time:?\s*(\d+(?:[.,]\d+)?)\s*min/i) * 60 || null),
    activations: g(/Number of activations:?\s*(\d+)/i), armingsMax: g(/Number of armings:?\s*(?:Maximum\s*)?(\d+)/i),
    energyKWh: m(/Energy[^0-9]{0,60}(\d+[.,]\d+)\s*kWh/i), pitBoost: /PIT BOOST/i.test(t), pitBoostKWh: m(/PIT BOOST[^]{0,300}?(\d+[.,]\d+)\s*kWh/i),
    lapAt80pct: m(/80%\s*of Race \(Lap\):?\s*(\d+)/i), raceDistanceLaps: m(/Race (?:Distance|Laps)[^0-9]{0,20}(\d+)\s*Laps/i), raceMinutes: m(/Race (?:Duration|Time)[^0-9]{0,20}(\d+)\s*min/i)}; }
if (process.argv[2] === '--selftest') {
  const p = parseNote('80% of Race (Lap): 24 Laps ATTACK MODE RACE (Article 37.3.b) 350kW Power Mode time: 480 seconds (8 minutes) total Number of activations: 2 activations Number of armings: Maximum 5');
  if (p.amKW !== 350 || p.amTimeS !== 480 || p.activations !== 2 || p.armingsMax !== 5 || p.lapAt80pct !== 24) throw new Error('selftest ' + JSON.stringify(p));
  console.log('selftest ok'); process.exit(0); }
const log = [];
const get = async (url, kind = 'json') => { for (let i = 0; ; i++) { try { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); return kind === 'json' ? r.json() : Buffer.from(await r.arrayBuffer()); } catch (e) { if (i >= 2) throw e; await new Promise(z => setTimeout(z, 1500 * (i + 1))); } } };
const items = async id => { const j = await get(IDX + id.split('/').map(encodeURIComponent).join('/') + '/index.json'), a = j.items || j.catalogs || j.files || [];
  if (!a.length) log.push(`${id}: empty index, keys ${Object.keys(j).join(',')}`);
  return a.map(x => ({...x, title: x.title ?? x.name ?? '', extention: x.extention ?? x.extension ?? x.format})); };
const out = [], tmp = mkdtempSync('/tmp/fe-note-');
const ROOT = await items('formula-e/files/noticeboard'); log.push('root: ' + JSON.stringify(ROOT.slice(0, 2)).slice(0, 300));
for (const s of ROOT.filter(x => SEASONS.test(x.title + ' ')))
  for (const ev of (await items(s.id)).filter(x => x.extention === 'catalog')) {
    let files = []; try { files = await items(ev.id); } catch (e) { log.push(`${ev.title}: ${e.message}`); continue; }
    const notes = files.filter(f => f.extention === 'pdf' && (/Event Note/i.test(f.title) || /Bulletin/i.test(f.title)));
    const n0 = out.length;
    for (const f of notes) { try { const p = `${tmp}/n.pdf`; writeFileSync(p, await get(FILES + f.url, 'buf'));
        const text = execFileSync('pdftotext', ['-layout', p, '-'], {encoding: 'utf8'});
        if (!/ATTACK MODE/i.test(text)) continue; // only documents that state Attack Mode
        out.push({season: s.title, event: ev.title, note: f.title, kind: /Bulletin/i.test(f.title) ? 'bulletin' : 'event note', lastModified: f.lastModified, url: FILES + f.url, ...parseNote(text)}); }
      catch (e) { log.push(`${ev.title} ${f.title}: ${e.message}`); } }
    if (out.length === n0) out.push({season: s.title, event: ev.title, note: null}); }
writeFileSync('fe-event-notes.json', JSON.stringify({source: 'FIA Formula E noticeboard (results.formulae.fia.com), Event Note – Race Information', rows: out, log}, null, 1));
console.log(out.length, 'rows', out.filter(r => r.amTimeS).length, 'with AM time', log.length, 'errors');
