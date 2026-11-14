// SRO official results (GT World Challenge Europe/America/Asia/Australia, British GT): every session table of every
// meeting from 2022 on. Runs in GitHub Actions (network). Output: sro-results.json.gz (cells as shown, parsed in the fit).
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com', 'https://www.gt-world-challenge-australia.com', 'https://www.britishgt.com'];
const FROM = 2022, UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(40000)}); if (r.ok) return await r.text(); if (r.status === 404) return ''; } catch {} await new Promise(s => setTimeout(s, 2000)); } return ''; };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&uuml;/g, 'ü').replace(/&ouml;/g, 'ö').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const cells = tr => [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => clean(m[1]));
const links = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, '')).filter(h => re.test(h)))];
const out = [];
for (const site of SITES) {
  const idx = await get(site + '/results');
  const sel = idx.match(/name="filter_season_id"[^>]*>([\s\S]*?)<\/select>/)?.[1] || '';
  const seasons = [...sel.matchAll(/value="(\d+)"[^>]*>\s*(\d{4})/g)].map(m => [m[1], +m[2]]).filter(([, y]) => y >= FROM && y <= 2026);
  for (const [sid, year] of seasons) {
    const list = await get(`${site}/results?filter_season_id=${sid}&filter_meeting_id=0`);
    const meetings = links(list, new RegExp(`^/results/${year}/[^/?#]+$`));
    for (const m of meetings) {
      const page = await get(site + m);
      const title = clean(page.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      const sessions = links(page, new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/?#]+$`));
      for (const s of sessions) {
        const t = await get(site + s), tab = t.match(/<table[\s\S]*?<\/table>/)?.[0];
        if (!tab) continue;
        const rows = [...tab.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(x => cells(x[0])).filter(r => r.length);
        out.push({site: site.replace(/^https:\/\/www\./, ''), year, meeting: m.split('/').pop(), title, session: s.split('/').pop(), header: rows[0], rows: rows.slice(1)});
      }
      console.log(site, year, m, sessions.length);
    }
  }
}
writeFileSync('scripts/sim/data/learn/sro-results.json.gz', gzipSync(JSON.stringify(out)));
console.log('sessions', out.length, 'rows', out.reduce((a, s) => a + s.rows.length, 0));
