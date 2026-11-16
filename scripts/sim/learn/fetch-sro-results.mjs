// Driver ratings, part 5 (task P1e): line-ups from the SRO results pages (official classifications). Each session page
// /results/<year>/<meeting>/<session> prints car number and "Drivers" ("Weian CHEN, Kaishun LIU"); no rating (the "Cat" column is the
// car's cup). Used for rounds whose entry list was never published (GTWC Asia / Australia). Drivers of a car = the union over the
// race sessions of the meeting (else qualifying, else practice). Runs in GitHub Actions. Writes scripts/sim/data/learn/sro-results-lineups.json.gz (rev 1).
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} } return null; };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com',
  'https://www.gt-world-challenge-australia.com', 'https://www.britishgt.com', 'https://www.intercontinentalgtchallenge.com'];
const pool = async (items, n, f) => { let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < items.length) { const k = i++; try { await f(items[k]); } catch (e) { console.log('skip', items[k], e.message); } } })); };
const rank = s => /race/i.test(s) ? 3 : /qualif/i.test(s) ? 2 : 1;
const lineups = [], log = [];
for (const site of SITES) {
  const meetings = new Set();
  for (let y = 2013; y <= 2026; y++) { const t = await get(`${site}/results/${y}`) || ''; for (const m of t.matchAll(/href="(?:https?:\/\/[^/"]+)?(\/results\/(\d{4})\/[^/"#?]+)"/g)) if (+m[2] === y) meetings.add(m[1]); }
  let pages = 0, cars = 0;
  await pool([...meetings], 4, async mp => { const t = await get(site + mp); if (!t) return; const title = clean(t.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    const sess = [...new Set([...t.matchAll(/href="(?:https?:\/\/[^/"]+)?(\/results\/\d{4}\/[^/"#?]+\/[^/"#?]+)"/g)].map(m => m[1]).filter(s => s.startsWith(mp + '/')))];
    const by = new Map(); // car -> {drivers:Set, rank, cls, vehicle}
    for (const s of sess) { const p = await get(site + s); if (!p) continue; pages++;
      for (const tab of p.match(/<table[\s\S]*?<\/table>/g) || []) {
        const rows = [...tab.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => clean(c[1])));
        const head = (rows.shift() || []).map(c => c.toLowerCase()), ci = head.findIndex(c => /^car ?#|^no\.?$|^#$/.test(c)), di = head.findIndex(c => /^drivers?$/.test(c));
        if (ci < 0 || di < 0) continue; const vi = head.findIndex(c => c === 'car'), ki = head.findIndex(c => /^cat|^class/.test(c)), rk = rank(s);
        for (const r of rows) { const car = (r[ci] || '').replace('#', '').trim(); if (!/^\d{1,3}$/.test(car)) continue;
          const ds = (r[di] || '').split(/\s*[,/]\s*|\s+-\s+/).map(x => x.trim()).filter(x => x.split(' ').length >= 2);
          const o = by.get(car) || by.set(car, {drivers: new Set(), rank: 0, vehicle: r[vi] || '', cls: r[ki] || ''}).get(car);
          if (rk > o.rank) { o.drivers = new Set(); o.rank = rk; } if (rk === o.rank) for (const d of ds) o.drivers.add(d); } } }
    const [, year, slug] = /\/results\/(\d{4})\/(.+)/.exec(mp);
    for (const [car, o] of by) if (o.drivers.size) { lineups.push({site: site.replace(/^https:\/\/www\./, ''), year: +year, meeting: 'results-' + slug, title: title.replace(/\s*\|.*$/, '') + ' Results', url: site + mp, car, team: '', vehicle: o.vehicle, cls: o.cls, drivers: [...o.drivers], from: ['', 'practice', 'qualifying', 'race'][o.rank]}); cars++; } });
  log.push(`${site}: ${meetings.size} meetings, ${pages} session pages, ${cars} cars`); console.log(log.at(-1));
}
writeFileSync('scripts/sim/data/learn/sro-results-lineups.json.gz', gzipSync(JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: 'SRO results pages (official classifications): drivers per car and meeting (race sessions, else qualifying, else practice). No rating printed. Built by fetch-sro-results.mjs.', log, lineups}), {level: 9}));
