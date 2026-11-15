// IGTC Bathurst 12 Hour gave no PDF rows: list its result files and print one qualifying text layout to the Actions log (nothing written).
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const site = 'https://www.intercontinentalgtchallenge.com', H = {headers: {'user-agent': 'Mozilla/5.0'}};
for (const y of [2024, 2025, 2026]) {
  const list = await (await fetch(`${site}/results/${y}`, H)).text();
  const m = [...list.matchAll(/href="([^"]*\/results\/\d{4}\/[^"?#]*bathurst[^"?#]*)"/gi)].map(x => x[1])[0]; console.log(y, 'meeting', m);
  if (!m) continue; const p = await (await fetch(m.startsWith('http') ? m : site + m, H)).text();
  const files = [...p.matchAll(/href="([^"]+)"/g)].map(x => x[1]).filter(h => /pdf|results|natsoft|timing/i.test(h)); console.log(files.slice(0, 40).join('\n'));
  const q = files.find(f => /\.pdf$/i.test(f) && /qual/i.test(f)); if (!q) continue;
  const b = Buffer.from(await (await fetch(q.startsWith('http') ? q : site + encodeURI(decodeURI(q)), H)).arrayBuffer()); writeFileSync('/tmp/b.pdf', b);
  console.log(execFileSync('pdftotext', ['-layout', '/tmp/b.pdf', '-']).toString().split('\n').slice(0, 30).join('\n')); break;
}
