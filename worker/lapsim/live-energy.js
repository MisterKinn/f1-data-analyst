// Live check for an event's FIA "Power Unit Information" document (published in race week): when the
// stored data has no official recharge limit yet, read it from fia.com on request (cached 3 h, 3 s
// time limit), so a prediction switches from the estimated to the official value without a deploy.
import {energyLimit} from './energy-limits.js';
import {eventFor} from './names.js';
import {parsePuInfo} from './pu-info.js';

const cache = new Map(), TTL = 3 * 3600e3;
export async function liveEnergyLimit(id, year = 2026, {timeoutMs = 3000} = {}) {
  const known = energyLimit(id, year);
  if (!known || known.status === 'official') return known;
  const name = eventFor(id, year); if (!name) return known;
  const key = `${year}/${id}`, c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.value || known;
  const lookup = (async () => {
    const {eventDocuments, fiaCall} = await import('../fia.js');
    const ev = await eventDocuments(year, name);
    const doc = ev?.records.filter(r => /power unit information/i.test(r.title) && !r.recalled).sort((a, b) => Number(b.document_number || 0) - Number(a.document_number || 0))[0];
    if (!doc) return null;
    const r = JSON.parse((await fiaCall('fia_read_document', {url: doc.url, start_page: 1, page_count: 4, limit: 16000})).content[0].text);
    const v = parsePuInfo(r.pages);
    return v ? {mj: v.qualiMJ, status: 'official', source: {title: doc.title, url: doc.url, published: doc.published || null}, values: v} : null;
  })();
  let value = null;
  try { value = await Promise.race([lookup, new Promise(res => setTimeout(() => res(undefined), timeoutMs))]); } catch {}
  if (value !== undefined) cache.set(key, {at: Date.now(), value});
  return value || known;
}
