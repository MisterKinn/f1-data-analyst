// Fetch and cache (positioned text, sha256) every official PDF cited by the given CSV files.
// Usage: node scripts/sim/fia-docs/dump.mjs <csv>...   (cache: FIA_DOCS_CACHE or .cache/fia-docs)
import {readCsv, pdfPages} from './lib.mjs';
const urls = new Set();
for (const f of process.argv.slice(2)) for (const r of readCsv(f).rows) for (const v of Object.values(r)) for (const u of v.match(/https:\/\/[^\s|,"]+/gi) || []) if (/\.pdf(#|$)|\/download\/\d+$/i.test(u)) urls.add(u.split('#')[0]);
let ok = 0; const bad = [];
for (const u of urls) { try { await pdfPages(u); ok++; } catch (e) { bad.push(e.message); } }
console.log(`${ok} of ${urls.size} PDFs cached`); for (const b of bad) console.log('FAILED', b);
