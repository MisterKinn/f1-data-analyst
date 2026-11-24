// Shared helpers for the official-document collectors (scripts/sim/data/fia-docs/README.md): fetch an official PDF, keep its sha256,
// read positioned text with unpdf (the reader worker/fia.js and worker/wec.js use), and read/write the CSV tables (RFC 4180).
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {getDocument} from 'unpdf/pdfjs';

// official hosts only (FIA, FIA WEC, Al Kamel)
const HOSTS = new Set(['www.fia.com', 'fia.com', 'api.fia.com', 'www.fiawec.com', 'fiawec.com', 'files.alkamelcloud.com', 'fiawec.alkamelsystems.com']);
export const CACHE = process.env.FIA_DOCS_CACHE || '.cache/fia-docs';

export function officialUrl(url) {
  const u = new URL(url); u.hash = '';
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) throw Error(`not an official document host: ${url}`);
  return u.href;
}

// fia.com answers HTTP 429 to bursts: keep 2 s between requests and back off (Retry-After when given)
let last = 0;
async function fetchBytes(url) {
  for (let i = 0; ; i++) {
    await new Promise(f => setTimeout(f, Math.max(0, last + 2000 - Date.now()))); last = Date.now();
    let wait = 5000 * (i + 1);
    try {
      const r = await fetch(url, {headers: {Accept: 'application/pdf, text/html'}, signal: AbortSignal.timeout(60000)});
      if (r.status === 429) wait = 1000 * (+r.headers.get('retry-after') || 30 * (i + 1));
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      if (!HOSTS.has(new URL(r.url).hostname)) throw Error(`redirected off the official hosts: ${r.url}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) { if (i === 4 || /HTTP 404|off the official/.test(e.message)) throw Error(`${url}: ${e.message}`); await new Promise(f => setTimeout(f, wait)); }
  }
}

// pages: [{page, width, height, items: [{s, x, y, w, h}]}], y measured from the top of the page; cached by URL (raw input kept with its sha256)
export async function pdfPages(url) {
  url = officialUrl(url);
  const key = createHash('sha256').update(url).digest('hex').slice(0, 24), f = `${CACHE}/${key}.json`;
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  const bytes = await fetchBytes(url), sha256 = createHash('sha256').update(bytes).digest('hex');
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error(`${url}: not a PDF`);
  const task = getDocument({data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, useWasm: false, maxImageSize: 0, verbosity: 0});
  const pdf = await task.promise, pages = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n), vp = p.getViewport({scale: 1}), c = await p.getTextContent();
      pages.push({page: n, width: vp.width, height: vp.height, items: c.items.filter(i => typeof i.str === 'string' && i.str.trim())
        .map(i => ({s: i.str, x: +i.transform[4].toFixed(1), y: +(vp.height - i.transform[5]).toFixed(1), w: +i.width.toFixed(1), h: +Math.abs(i.transform[3] || i.height).toFixed(1)}))});
      p.cleanup();
    }
  } finally { await task.destroy(); }
  const doc = {url, sha256, retrieved: new Date().toISOString(), pages};
  mkdirSync(CACHE, {recursive: true}); writeFileSync(f, JSON.stringify(doc));
  return doc;
}

// text lines of a page: items grouped by baseline (tolerance tol), left to right
export function lines(page, tol = 2) {
  const rows = [];
  for (const it of [...page.items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = rows.find(q => Math.abs(q.y - it.y) <= tol); if (r) r.items.push(it); else rows.push({y: it.y, items: [it]});
  }
  for (const r of rows) { r.items.sort((a, b) => a.x - b.x); r.text = r.items.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(); r.x = r.items[0].x; }
  return rows.sort((a, b) => a.y - b.y);
}

export function readCsv(file) {
  const t = readFileSync(file, 'utf8').replace(/^﻿/, ''), rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0]);
  return {head, rows: body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))};
}

const cell = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
export function writeCsv(file, head, rows, {bom = false} = {}) {
  writeFileSync(file, (bom ? '﻿' : '') + [head, ...rows.map(r => head.map(h => r[h]))].map(r => r.map(cell).join(',')).join('\n') + '\n');
}

// row-level diff on a key; reports added, removed and changed fields (used to compare a rebuild with the committed CSV)
export function diffRows(oldRows, newRows, keyOf, fields) {
  const keyed = rows => { const n = {}; return new Map(rows.map(r => { const k = keyOf(r); n[k] = (n[k] || 0) + 1; return [n[k] > 1 ? `${k}#${n[k]}` : k, r]; })); };
  const a = keyed(oldRows), b = keyed(newRows), out = [];
  for (const [k, r] of a) if (!b.has(k)) out.push({kind: 'missing in rebuild', key: k});
  for (const [k, r] of b) if (!a.has(k)) out.push({kind: 'new in rebuild', key: k});
  for (const [k, r] of a) { const n = b.get(k); if (!n) continue; const d = fields.filter(f => String(r[f] ?? '') !== String(n[f] ?? '')); if (d.length) out.push({kind: 'changed', key: k, fields: Object.fromEntries(d.map(f => [f, [r[f], n[f]]]))}); }
  return out;
}

// print a diff (from diffRows), one line per row; returns the number of differing rows
export function report(name, diffs) {
  console.log(`${name}: ${diffs.length} row(s) differ from the committed CSV`);
  for (const d of diffs) console.log(`  ${d.kind}: ${d.key}${d.fields ? '  ' + Object.entries(d.fields).map(([f, [o, n]]) => `${f}: ${JSON.stringify(o)} -> ${JSON.stringify(n)}`).join('; ') : ''}`);
  return diffs.length;
}
