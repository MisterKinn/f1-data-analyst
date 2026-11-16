// Driver ratings, part 4 (task P1e): line-ups of the Nürburgring 24h and its ADAC Qualifiers (series "nur"; Timing71 rows have no
// drivers). Source: the official ADAC Nordrhein entry lists ("Starterliste" / "Teilnehmerliste", 24h-media.de, nuerburgring-langstrecken-serie.de,
// copies on endurance-info.com / gt-place.com). They name the drivers per car, no FIA category: the rating comes from the FIA list of the
// season (build-driver-ratings.mjs, how: fia-list). Runs in GitHub Actions (network, poppler). Writes scripts/sim/data/learn/n24-lineups.json
// (rev 1).
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
  const cars = []; let cur = null;
  for (const raw of txt.split('\n')) { const l = raw.replace(/\s+$/, ''); if (!l.trim()) continue;
    const c = /^\s{0,4}#?(\d{1,3})\s+(\d{1,3})\s{1,}(\S.*)$/.exec(l);
    if (c && !NAT.test(l.slice(0, 40))) { cur = {car: c[1], head: c[3].replace(/\s{2,}/g, ' | '), names: []}; cars.push(cur); }
    if (!cur) continue;
    for (const m of l.matchAll(/([A-Za-zÀ-ÿ'’.\- ]{2,40}?), ([A-Za-zÀ-ÿ'’.\- ]{2,30}?) \(([A-Z]{3})\)/g)) cur.names.push(`${m[2].trim()} ${m[1].trim()}`);
    if (!c) { const p = /^\s{2,}([„"“]?[A-Za-zÀ-ÿ'’.\- ]{3,40}?[“"]?)\s{2,}[^()]*\(([A-Z]{3})\)/.exec(l) || /^\s{2,}([A-Za-zÀ-ÿ'’.\- ]{3,40}?)\s+[A-Za-zÀ-ÿ.\-/ ]{2,30}\s\(([A-Z]{3})\)/.exec(l);
      if (p && !/,/.test(p[1])) cur.names.push(p[1].replace(/[„"“”]/g, '').trim()); } }
  return cars.filter(c => c.names.length).map(c => ({...c, names: [...new Set(c.names)]}));
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
