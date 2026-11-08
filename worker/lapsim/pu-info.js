// Parser for the FIA "Power Unit Information" event document (2026+): maximum recharge per lap by
// session (Article C5.2.10). Values are matched to their column headers by x position, so the
// parser does not depend on the order of the text.
const LABELS = [
  {key: 'qualiMJ', re: /^qualifying/i}, {key: 'practiceMJ', re: /^free practice/i}, {key: 'outLapMJ', re: /^out laps/i},
  {key: 'raceMJ', re: /^overtake not/i}, {key: 'raceOvertakeMJ', re: /^overtake active/i},
];
export function parsePuInfo(pages) {
  for (const p of pages || []) {
    const rows = p.rows || [], at = rows.findIndex(r => r.cells.some(c => /maximum recharge per lap/i.test(c.text)));
    if (at < 0) continue;
    const valueRow = rows.slice(at).find(r => r.cells.filter(c => /^\d+(?:\.\d+)?\s*MJ$/i.test(c.text.trim())).length >= 3);
    if (!valueRow) continue;
    const heads = rows.slice(at, rows.indexOf(valueRow)).flatMap(r => r.cells).map(c => ({x: c.x, label: LABELS.find(l => l.re.test(c.text.trim()))})).filter(h => h.label);
    const out = {};
    for (const c of valueRow.cells) {
      const m = c.text.trim().match(/^(\d+(?:\.\d+)?)\s*MJ$/i); if (!m) continue;
      let best = null; for (const h of heads) if (!best || Math.abs(h.x - c.x) < Math.abs(best.x - c.x)) best = h;
      if (best && Math.abs(best.x - c.x) < 45 && out[best.label.key] == null) out[best.label.key] = Number(m[1]);
    }
    if (out.qualiMJ != null) return out;
  }
  return null;
}
