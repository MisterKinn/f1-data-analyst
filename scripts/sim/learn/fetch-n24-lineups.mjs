// Driver ratings, part 4 (task P1e): line-ups of the Nürburgring 24h and its ADAC Qualifiers (series "nur"; Timing71 rows have no
// drivers). Source: the official ADAC Nordrhein entry lists ("Starterliste" / "Teilnehmerliste", 24h-media.de, nuerburgring-langstrecken-serie.de,
// copies on endurance-info.com / gt-place.com). They name the drivers per car, no FIA category: the rating comes from the FIA list of the
// season (build-driver-ratings.mjs, how: fia-list). Runs in GitHub Actions (network, poppler). Writes scripts/sim/data/learn/n24-lineups.json
// (rev 5).
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const TMP = mkdtempSync(join(tmpdir(), 'n24-')), UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
// [year, event kind, url] — later entries of the same event win (final list after document acceptance before provisional ones)
const LISTS = [
  [2023, 'race', 'https://www.endurance-info.com/sites/default/files/2023-05/Liste%20des%20engag%C3%A9s.pdf'],
  [2023, 'race', 'https://www.24h-media.de/downloads/2023-ADAC-TotalEnergies-24h-Nuerburgring/24h_nbr_01_Starterliste.pdf'],
  [2023, 'qualifiers', 'https://www.24h-media.de/media-downloads/meldungen/4991.pdf'],
  [2023, 'qualifiers', 'https://www.24h-media.de/downloads/2023-ADAC-24h-Qualifiers/01_ADAC_Qualifiers_2023_Teilnehmerliste.pdf'],
  [2024, 'qualifiers', 'https://www.nuerburgring-langstrecken-serie.de/wp-content/uploads/ergebnisse/2024-04-14s.pdf'],
  [2024, 'race', 'https://www.endurance-info.com/sites/default/files/2024-05/Liste%20des%20engag%C3%A9s_1.pdf'],
  [2024, 'race', 'https://gt-place.com/wp-content/uploads/2024/05/24_LOG_B_019_24h_race_provisional_list_of_participants_after_administrative_check_2024_status_30052024.pdf'],
  [2025, 'qualifiers', 'https://www.nuerburgring-langstrecken-serie.de/wp-content/uploads/ergebnisse/2025-05-24s.pdf'],
  [2025, 'qualifiers', 'https://24h-media.de/downloads/Ergebnisse/2025/2025-ADAC-24h-Nuerburgring-Qualifiers/Q24h_2025_01_Entry-List_final.pdf'],
  [2025, 'race', 'https://24h-media.de/downloads/Ergebnisse/2025/2025-ADAC-RAVENOL-24h-Nuerburgring/24h_nbr_01_Starterliste_final.pdf'],
  [2026, 'qualifiers', 'https://www.endurance-info.com/sites/default/files/2026-04/Liste%20des%20engage%CC%81s%2015%20avril.pdf'],
  [2026, 'qualifiers', 'https://www.endurance-info.com/sites/default/files/2026-06/Liste%20des%20engag%C3%A9s.pdf'],
  [2026, 'race', 'https://www.24h-media.de/media-downloads/meldungen/5360.pdf'],
  [2026, 'race', 'https://www.endurance-info.com/sites/default/files/2026-05/Liste%20des%20engage%CC%81s.pdf']];
const get = async u => { for (const x of [u, `https://web.archive.org/web/2id_/${u}`]) { try { const r = await fetch(x, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.subarray(0, 4).toString() === '%PDF') return b; } } catch {} } return null; };
const NAT = /\(([A-Z]{3})\)/;
// Two layouts: press list ("  1  23  Team   SP 9 PRO" then "     First Last    City (GER)   Make") and DMSB list ("Last, First (GER)").
export function parseN24(txt) {
  // DMSB list ("Start-Nr. Box Bewerber / Fahrer"): one block per car starting at the entrant line (entrant + licence, no nation); the
  // start number sits in the middle of the block, the drivers ("Last, First (GER)"; a pseudonym prints as "SELV, (KGZ)") above and below it
  if (/Start-(Nr|No)\.?\s+Box/.test(txt)) { const out = []; let blk = null;
    for (const l of txt.split('\n')) { const name = l.slice(0, 46);
      if (/^\s{8,20}\S/.test(l) && !/[(),]/.test(name) && !/Stand|Anzahl|Status|Number|Nürburgring|approval|Genehmigung/i.test(l)) { blk = {car: null, head: name.trim(), names: []}; out.push(blk); continue; }
      if (!blk) continue; const c = /^(\d{1,3})\s{2,}\d{1,3}\s/.exec(l); if (c && !blk.car) blk.car = c[1];
      const m = /([A-Za-zÀ-ÿ'’.\- ]{2,40}?), ?([A-Za-zÀ-ÿ'’.\- ]{0,30}?) ?\(([A-Z]{3})\)/.exec(name); if (m) blk.names.push(`${m[2].trim()} ${m[1].trim()}`.trim().replace(/^\d+\s+\d+\s+/, '')); }
    return out.filter(b => b.car && b.names.length).map(b => ({...b, names: [...new Set(b.names)]})); }
  const cars = []; let cur = null;
  for (const raw of txt.split('\n')) { const l = raw.replace(/\s+$/, ''); if (!l.trim()) continue;
    const c = /^\s{0,4}#?(\d{1,3})\s+(\d{1,3})\s{1,}(\S.*)$/.exec(l);
    if (c && !NAT.test(l.slice(0, 40))) { cur = {car: c[1], head: c[3].replace(/\s{2,}/g, ' | '), names: []}; cars.push(cur); }
    if (!cur) continue;
    // driver line: name, city (the name may run into the city column with one space: then the city is its last word), "(GER)"
    if (!c) (cur.raw ||= []).push(l); }
  // per car: the city column starts where the second chunk (after a gap of 2+ spaces) starts on its lines; a line whose name runs into
  // the city (one space) is cut at that column. A car with a line that cannot be cut is dropped (never a partial line-up).
  for (const car of cars) { const R = car.raw || [], ind = l => l.search(/\S/), withNat = R.filter(l => NAT.test(l));
    // driver lines: those at the name column (the indent of the lines that carry a nation), a city that wraps ("Duluth,\n GA (USA)") included
    const nameX = withNat.map(ind).sort((a, b) => withNat.filter(l => ind(l) === b).length - withNat.filter(l => ind(l) === a).length)[0];
    const L = nameX == null ? [] : R.filter(l => Math.abs(ind(l) - nameX) <= 1).map(l => l.replace(/\s*\([A-Z]{3}\).*$/, ' ')); const xs = L.map(l => /^(\s*\S.*?\S?)\s{2,}\S/.exec(l)).filter(Boolean).map(m => m[1].length + /\s{2,}/.exec(L.find(x => x.startsWith(m[1])).slice(m[1].length))[0].length);
    const cityX = xs.length ? Math.min(...xs) : null;
    for (const l of L) { const words = [...l.matchAll(/\S+/g)].map(m => ({t: m[0], x: m.index})), gap = /\S\s{2,}\S/.exec(l);
      const n = (gap ? l.slice(0, gap.index + 1) : cityX != null ? words.filter(w => w.x < cityX - 1).map(w => w.t).join(' ') : '').replace(/[„"“”]/g, '').trim();
      if (n.split(' ').length >= 2) car.names.push(n); else if (!n || /^[A-Z]{2}$/.test(n) === false) car.bad = true; } } // "GA (USA)": wrapped city line, not a driver
  return cars.filter(c => c.names.length && c.names.length <= 6 && !c.bad).map(({raw, bad, ...c}) => ({...c, names: [...new Set(c.names)]}));
}
const lineups = [], log = [];
for (const [year, kind, url] of LISTS) {
  const buf = await get(url); if (!buf) { log.push(`not reachable ${url}`); console.log(log.at(-1)); continue; }
  const f = join(TMP, 'l.pdf'); writeFileSync(f, buf); const txt = execFileSync('pdftotext', ['-layout', f, '-']).toString();
  const cars = parseN24(txt), head = txt.split('\n').filter(l => l.trim()).slice(0, 4).map(l => l.trim()).join(' | ');
  log.push(`${year} ${kind}: ${cars.length} cars, ${cars.reduce((n, c) => n + c.names.length, 0)} drivers — ${head.slice(0, 160)} — ${url}`); console.log(log.at(-1));
  console.log('::group::sample ' + url); console.log(txt.split('\n').filter(l => l.trim()).slice(0, 40).map(l => l.slice(0, 180)).join('\n')); console.log(JSON.stringify(cars.slice(0, 4))); console.log('::endgroup::');
  const title = `${kind === 'race' ? 'ADAC 24h Nürburgring' : 'ADAC 24h Nürburgring Qualifiers'} Entry List ${year}`;
  for (const c of cars) lineups.push({site: 'n24', year, meeting: `${kind}-${year}`, title, url, car: c.car, team: '', vehicle: '', cls: c.head, drivers: c.names});
}
// a later list of the same event replaces the earlier one per car
const seen = new Map(); for (const l of lineups) seen.set(`${l.meeting}|${l.car}`, l);
writeFileSync('scripts/sim/data/learn/n24-lineups.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: 'Official ADAC Nordrhein entry lists of the Nürburgring 24h and its Qualifiers: drivers per car (no category printed). Built by fetch-n24-lineups.mjs.', log, lineups: [...seen.values()]}));
