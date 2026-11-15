// GTWC Australia PDFs gave no rows: print the text layout of one qualifying PDF to the Actions log (nothing is written).
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const u = 'https://www.gt-world-challenge-australia.com/images/results/', site = 'https://www.gt-world-challenge-australia.com';
const page = await (await fetch(site + '/results/2025', {headers: {'user-agent': 'Mozilla/5.0'}})).text();
const meet = [...page.matchAll(/href="(\/results\/2025\/[^"?#]+)"/g)].map(m => m[1])[0];
const mp = await (await fetch(site + meet, {headers: {'user-agent': 'Mozilla/5.0'}})).text();
const pdf = [...mp.matchAll(/href="([^"]+\.pdf)"/gi)].map(m => m[1]).find(f => /qualif/i.test(f));
console.log(meet, pdf);
const b = Buffer.from(await (await fetch(pdf.startsWith('http') ? pdf : site + encodeURI(decodeURI(pdf)))).arrayBuffer()); writeFileSync('/tmp/a.pdf', b);
console.log(execFileSync('pdftotext', ['-layout', '/tmp/a.pdf', '-']).toString().split('\n').slice(0, 45).join('\n'));
console.log('--- raw (no -layout)'); console.log(execFileSync('pdftotext', ['/tmp/a.pdf', '-']).toString().split('\n').slice(0, 60).join('\n'));
