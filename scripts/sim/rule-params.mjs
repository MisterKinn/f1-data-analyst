// Reads the regulation values the lap simulator uses from the newest official documents and
// writes worker/lapsim/rules-data.js plus docs/lapsim-rules.md (what changed, with sources).
// Spec: knowledge/sim-rule-params.json. Sources: knowledge/rules-sources.json (same listings the
// rules monitor reads). A value that is missing or outside its range keeps the previous value.
// Usage: node scripts/sim/rule-params.mjs [--dry-run]
import {readFile, writeFile} from 'node:fs/promises';
import {getDocument} from 'unpdf/pdfjs';
import {candidates} from '../rules-monitor.mjs';

const DRY = process.argv.includes('--dry-run');
const OUT = 'worker/lapsim/rules-data.js', REPORT = 'docs/lapsim-rules.md';
const UA = 'KongbodaMotorsports-RulesMonitor/1.0 (+https://kongboda-motorsports.vercel.app)';

// PDF text with fixed article numbers ("C5. 2 .3" -> "C5.2.3") and single spaces.
// column 'right': only the right-hand column (English side of bilingual FIA documents).
export async function pdfText(bytes, {column} = {}) {
  const pdf = await getDocument({data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, useWasm: false, maxImageSize: 0, verbosity: 0}).promise;
  try {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i), c = await p.getTextContent(), w = p.view[2] || 595, rows = [];
      for (const it of c.items) {
        if (typeof it.str !== 'string' || !it.str.trim()) continue;
        const x = it.transform[4]; if (column === 'right' && x < w * 0.5) continue;
        const y = Math.round(it.transform[5]); let row = rows.find(r => Math.abs(r.y - y) <= 2);
        if (!row) { row = {y, items: []}; rows.push(row); } row.items.push({x, t: it.str});
      }
      rows.sort((a, b) => b.y - a.y);
      pages.push({page: i, text: normalize(rows.map(r => r.items.sort((a, b) => a.x - b.x).map(x => x.t).join(' ')).join(' '))});
      p.cleanup();
    }
    return pages;
  } finally { await pdf.destroy?.(); }
}

export const normalize = s => s.replace(/\s+/g, ' ')
  .replace(/\b([A-Z]?\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\b/g, '$1.$2.$3')
  .replace(/(\d)\s+MJ\b/g, '$1MJ').replace(/ERS\s*-\s*K/g, 'ERS-K').trim();

// Extract one value: the pattern's first group, last number in it (marked-up issues print the old
// value, then the new one).
export function extract(pages, param, {section} = {}) {
  let start = 0;
  if (section) { const i = pages.findIndex(p => p.text.includes(section)); if (i < 0) return {error: `section "${section}" not found`}; start = i; }
  const re = new RegExp(param.pattern, 'i');
  for (const p of pages.slice(start)) {
    const text = section && p === pages[start] ? p.text.slice(p.text.indexOf(section)) : p.text;
    const m = re.exec(text); if (!m) continue;
    const nums = (m[1].match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (!nums.length) continue;
    const value = nums.at(-1), [lo, hi] = param.range || [-Infinity, Infinity];
    if (!(value >= lo && value <= hi)) return {error: `value ${value} outside ${lo}–${hi}`, page: p.page};
    return {value, page: p.page, previousIssueValue: nums.length > 1 ? nums.at(-2) : null, excerpt: m[0].slice(0, 160)};
  }
  return {error: 'pattern not found'};
}

async function main() {
  const spec = JSON.parse(await readFile('knowledge/sim-rule-params.json', 'utf8'));
  const sourcesFile = JSON.parse(await readFile('knowledge/rules-sources.json', 'utf8'));
  const sources = Array.isArray(sourcesFile) ? sourcesFile : sourcesFile.sources;
  let previous = {};
  try { previous = (await import('../../' + OUT + '?t=' + Date.now())).lapsimRules || {}; } catch {}
  const out = structuredClone(previous), report = ['# Regulation values used by the lap simulator', '', `Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, ''];
  const changes = [];
  const docCache = new Map();
  for (const target of spec.targets) {
    const src = sources.find(s => s.id === target.source);
    report.push(`## ${target.car}`, '');
    try {
      if (!src) throw Error(`source ${target.source} not in rules-sources.json`);
      const list = (await candidates(src, new Date())).filter(d => new RegExp(target.document, 'i').test(d.title + ' ' + decodeURIComponent(d.url)));
      // newest issue first: publication date, then issue number in the title
      const issueNo = t => Number((t.match(/\b(?:iss(?:ue)?|v)\s*0*(\d+)/i) || [])[1] || 0);
      list.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')) || issueNo(b.title) - issueNo(a.title));
      const doc = list[0]; if (!doc) throw Error(`no document matching "${target.document}"`);
      const key = doc.url + '|' + (target.column || '');
      if (!docCache.has(key)) {
        const r = await fetch(doc.url, {headers: {'user-agent': UA}}); if (!r.ok) throw Error(`HTTP ${r.status} for ${doc.url}`);
        docCache.set(key, await pdfText(new Uint8Array(await r.arrayBuffer()), {column: target.column}));
      }
      const pages = docCache.get(key);
      const values = {...(target.inherit ? out[target.inherit]?.values : {}), ...(out[target.car]?.values || {})};
      for (const param of target.params) {
        const e = extract(pages, param, {section: target.section});
        if (e.error) { report.push(`- ${param.key} (${param.article}): not updated, ${e.error}. Kept ${values[param.key]?.value ?? 'none'}.`); continue; }
        const v = {value: e.value, article: param.article, page: e.page, document: doc.title, url: `${doc.url}#page=${e.page}`, published: doc.published || null};
        if (values[param.key]?.value !== e.value) changes.push(`${target.car} ${param.key}: ${values[param.key]?.value ?? 'none'} → ${e.value} (${param.article}, ${doc.title})`);
        values[param.key] = v;
        report.push(`- ${param.key} = ${e.value} (${param.article}, p.${e.page})`);
      }
      out[target.car] = {values, document: {title: doc.title, url: doc.url, published: doc.published || null}, checked: new Date().toISOString().slice(0, 10)};
      report.push('', `Source: [${doc.title}](${doc.url})`, '');
    } catch (err) {
      report.push(`Not checked: ${err.message}. Previous values kept.`, '');
    }
  }
  report.splice(3, 0, changes.length ? `Changes in this check:\n${changes.map(c => `- ${c}`).join('\n')}\n` : 'No value changed in this check.\n');
  console.log(report.join('\n'));
  if (DRY) return;
  await writeFile(OUT, `// Generated by scripts/sim/rule-params.mjs from official regulations (knowledge/sim-rule-params.json).\nexport const lapsimRules=${JSON.stringify(out)};\n`);
  await writeFile(REPORT, report.join('\n') + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
