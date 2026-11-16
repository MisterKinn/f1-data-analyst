// Probe (task P1d): layout of the 2018 FIA Driver Categorisation lists, whose medal columns the list parser in
// fetch-sro-lineups.mjs does not find. Prints the first page text and the XML text boxes of page 2 (log only, writes nothing).
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const TMP = mkdtempSync(join(tmpdir(), 'fia18-'));
for (const url of ['https://sportscar365.com/wp-content/uploads/2017/12/2018-FIA-Drivers-Categorisation-list_141217.pdf', 'https://www.fia.com/file/63678/download?token=OcTV602F']) {
  let buf = null; for (const u of [url, `https://web.archive.org/web/2id_/${url}`]) { try { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.subarray(0, 4).toString() === '%PDF') { buf = b; break; } } } catch {} }
  console.log('====', url, buf ? buf.length : 'not reachable'); if (!buf) continue;
  const f = join(TMP, 'l.pdf'); writeFileSync(f, buf);
  console.log(execFileSync('pdftotext', ['-layout', '-f', '1', '-l', '2', f, '-']).toString().split('\n').slice(0, 70).join('\n'));
  const xml = execFileSync('pdftohtml', ['-xml', '-i', '-zoom', '1', '-f', '2', '-l', '2', '-stdout', f]).toString();
  console.log(xml.split('\n').filter(l => /<text|<image/.test(l)).slice(0, 60).join('\n'));
  console.log('images on page 2:', execFileSync('pdfimages', ['-list', '-f', '2', '-l', '2', f]).toString().split('\n').length - 3);
}
