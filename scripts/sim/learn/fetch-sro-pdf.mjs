// SRO results published only as PDF (owner 2026-11-15: every measured lap): Intercontinental GT Challenge (Bathurst 12h, Spa 24h,
// Nürburgring 24h, Suzuka 1000 km, Indianapolis 8h, Kyalami 9h ...) and GT World Challenge Australia, every season from 2013.
// Runs in GitHub Actions (network, poppler). Rerun 2026-11-15 for the Australian time format. Each classification PDF -> pdftotext -layout -> one row per car: number, car text, best
// lap (the fastest m:ss.sss on its line). Only derived rows are written (no PDF, no driver names):
// scripts/sim/data/learn/sro-pdf-cars.csv.gz in the shape of build-sro.mjs.
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {COLS, csvLine} from './build-endurance.mjs';
const SITES = ['https://www.intercontinentalgtchallenge.com', 'https://www.gt-world-challenge-australia.com'], FROM = 2013, TMP = mkdtempSync(join(tmpdir(), 'sro-pdf-'));
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 2000)); } return null; };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&uuml;/g, 'ü').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const links = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, '')).filter(h => re.test(h)))];
const MAKE = /\b(Audi|BMW|Mercedes|Porsche|Ferrari|Lamborghini|McLaren|Aston Martin|Bentley|Nissan|Honda|Acura|Lexus|Chevrolet|Corvette|Ford|Toyota|Callaway|Jaguar|Emil Frey|Maserati|Ginetta|KTM|Glickenhaus)\b/i;
// GTWC Australia (Natsoft) prints 1:25.5383* (four decimals, a mark for the fastest or a record lap)
const lapS = t => { const m = /^(\d{1,2}):(\d{2}\.\d{3,4})[*Rr]?$/.exec(t); return m ? +(+m[1] * 60 + +m[2]).toFixed(3) : null; };
const typeOf = f => /race|final(?! ?qual)|classification(?!.*(qual|practice|test|warm|pre))/i.test(f) && !/qual|practice|test|warm/i.test(f) ? 'R' : /qual|pole|q\d/i.test(f) && !/pre ?qual/i.test(f) ? 'Q' : /practice|test|warm|pre ?qual|fp\d/i.test(f) ? 'P' : null;
const out = [];
for (const site of SITES) {
  const idx = await get(site + '/results'); if (!idx) continue;
  const sel = idx.match(/name="filter_season_id"[^>]*>([\s\S]*?)<\/select>/)?.[1] || '';
  const seasons = [...sel.matchAll(/value="(\d+)"[^>]*>\s*(\d{4})/g)].map(m => [m[1], +m[2]]).filter(([, y]) => y >= FROM && y <= 2026);
  for (const [sid, year] of seasons) {
    const list = await get(`${site}/results?filter_season_id=${sid}&filter_meeting_id=0`) || '';
    for (const m of links(list, new RegExp(`^/results/${year}/[^/?#]+$`))) {
      const page = await get(site + m) || '', title = clean(page.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), venue = (title.split('|')[1] || m.split('/').pop()).trim();
      const pdfs = links(page, /\.pdf$/i).filter(f => !/aggregate|combined|entry|grid|chart|analysis|standing|bulletin|decision|document/i.test(decodeURIComponent(f)));
      for (const f of pdfs) { const name = decodeURIComponent(f.split('/').pop()), type = typeOf(name); if (!type) continue;
        const buf = await get(site + encodeURI(decodeURI(f)), true); if (!buf) continue; const p = join(TMP, 'x.pdf'); writeFileSync(p, buf);
        let txt = ''; try { txt = execFileSync('pdftotext', ['-layout', p, '-'], {maxBuffer: 1 << 26}).toString(); } catch { continue; }
        let n = 0;
        for (const line of txt.split('\n')) { const cells = line.trim().split(/\s{2,}/); const car = cells.find(c => MAKE.test(c)); if (!car) continue;
          const laps = cells.flatMap(c => c.split(/\s+/)).map(lapS).filter(x => x && x > 40 && x < 600); if (!laps.length) continue;
          const entry = cells.slice(0, 3).find(c => /^\d{1,3}$/.test(c) && cells.indexOf(c) > 0) || cells.find(c => /^#?\d{1,3}$/.test(c)) || '';
          const o = {series: site.includes('australia') ? 'gtwc' : 'igtc', season: year, event: `${site.includes('australia') ? 'gt-world-challenge-australia' : 'igtc'} | ${venue}`, session: name.replace(/\.pdf$/i, ''), type, cls: /GT4/i.test(line) ? 'GT4' : '', entry: entry.replace('#', ''), vehicle: car.slice(car.search(MAKE)).slice(0, 60).replace(/\bEVO\s*(ll|11|II)\b/i, 'EVO II').replace(/\s+\d{3,5}$/, ''), team: '', best: Math.min(...laps).toFixed(3), laps: ''};
          out.push(csvLine([...COLS.map(c => o[c] ?? ''), venue, site.includes('australia') ? 'gt-world-challenge-australia' : 'intercontinentalgtchallenge'])); n++; }
        console.log(site.slice(12, 40), year, venue, type, name.slice(0, 60), n);
      }
    }
  }
}
writeFileSync('scripts/sim/data/learn/sro-pdf-cars.csv.gz', gzipSync([...COLS, 'venue', 'feed'].join(',') + '\n' + out.join('\n') + '\n'));
console.log('rows', out.length);
