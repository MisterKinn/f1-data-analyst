// Parser for the FIA "Power Unit Information" event document (2026+): maximum recharge per lap by
// session (Article C5.2.10). Values are matched to their column headers by x position, so the
// parser does not depend on the order of the text.
const LABELS = [
  {key: 'qualiMJ', re: /^qualifying/i}, {key: 'practiceMJ', re: /^free practice/i}, {key: 'outLapMJ', re: /^out laps/i},
  {key: 'raceMJ', re: /^overtake not/i}, {key: 'raceOvertakeMJ', re: /^overtake active/i},
  // round 1 (Melbourne 2026) heads the race columns "Normal lap" and "Overtake"
  {key: 'raceMJ', re: /^normal lap/i}, {key: 'raceOvertakeMJ', re: /^overtake$/i},
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

// Everything else the "Power Unit Information" document sets per event (owner 2026-11-15: reflect each circuit's PU document):
// round, power-limited distance and power reduction rate (Art. C5.12.8), and the sector tables by lap-distance window (m):
// alt: where the alternative MGU-K curve (Alt 1) applies in Sprint and Race (C5.2.8iii); bigCut: where the reduction at the start of a
// power-limited period may exceed 150 kW, with that maximum (C5.12.4); reset: where an MGU-K power-reduction reset is allowed
// (C5.12.5); speed: sectors with a higher speed threshold (C5.12.7); overtake detection and activation lines (B7.2).
// Sectors in [ ] apply to Sprint Qualifying and Qualifying only (qOnly). Cells are matched to their column header by x position.
// The MGU-K curves themselves are a chart without numbers in the document: not read.
export function parsePuSectors(pages) {
  const num = t => { const m = String(t).match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
  const win = t => { const m = String(t).match(/\[?\s*(\d+)\s*-\s*(\d+)\s*\]?/); return m ? {from: +m[1], to: +m[2], qOnly: /\[/.test(t)} : null; };
  for (const p of pages || []) {
    const rows = p.rows || [], text = rows.map(r => r.cells.map(c => c.text).join(' ')).join('\n');
    if (!/IDENTIFICATION OF SECTORS/i.test(text)) continue;
    const out = {round: num((text.match(/ROUND No\.\s*R?(\d+)/i) || [])[1]), centrelineKm: num((text.match(/CENTRELINE\s*([\d.]+)\s*km/i) || [])[1]), alt: [], bigCut: [], reset: [], speed: [], overtake: null};
    const lim = rows.find(r => r.cells.some(c => /^\d+\s*m$/.test(c.text.trim())) && r.cells.some(c => /MJ/.test(c.text)));
    if (lim) { out.powerLimitedDistanceM = num(lim.cells.find(c => /^\d+\s*m$/.test(c.text.trim())).text); const rate = lim.cells.find(c => /kW\/s/i.test(c.text)); out.rampKWs = rate ? num(rate.text) : null; }
    // exception table: the header row with three "Identification of" cells gives the columns
    const hi = rows.findIndex(r => r.cells.filter(c => /^Identification of/i.test(c.text.trim())).length >= 3);
    const end = rows.findIndex((r, i) => i > hi && r.cells.some(c => /C5\.12\.7/.test(c.text)));
    if (hi >= 0) {
      const H = rows[hi].cells, xs = {id1: H[0].x, w1: H[1].x, id2: H[2].x, w2: H[3].x, kw: H[4].x, id3: H[5].x, w3: H[6].x};
      const col = c => Object.entries(xs).reduce((b, [k, x]) => Math.abs(c.x - x) < Math.abs(c.x - xs[b]) ? k : b, 'id1');
      for (const r of rows.slice(hi + 2, end < 0 ? undefined : end)) {
        const by = {}; for (const c of r.cells) (by[col(c)] ||= []).push(c.text.trim());
        if (by.w1 && win(by.w1[0])) out.alt.push({sector: (by.id1 || [''])[0], ...win(by.w1[0])});
        if (by.w2 && win(by.w2[0])) out.bigCut.push({sector: (by.id2 || [''])[0], ...win(by.w2[0]), maxKW: by.kw ? num(by.kw[0]) : null});
        if (by.w3 && win(by.w3[0])) out.reset.push({sector: (by.id3 || [''])[0], ...win(by.w3[0])});
      }
    }
    if (end >= 0) {
      const sh = rows.findIndex((r, i) => i > end && r.cells.some(c => /Speed threshold/i.test(c.text)));
      for (const r of rows.slice(sh + 1)) {
        const w = r.cells.find(c => win(c.text) && c.x < 180), th = r.cells.find(c => /km\/h/i.test(c.text));
        if (w) out.speed.push({sector: (r.cells.find(c => c.x < 100) || {text: ''}).text.trim(), ...win(w.text), kph: th ? num(th.text) : null});
        const lines = r.cells.filter(c => c.x > 400 && /\d+\s*m/.test(c.text));
        if (lines.length >= 2) out.overtake = {detectionM: num(lines[0].text), activationM: num(lines[1].text), tbc: lines.some(c => /TBC/i.test(c.text))};
      }
    }
    return out;
  }
  return null;
}
