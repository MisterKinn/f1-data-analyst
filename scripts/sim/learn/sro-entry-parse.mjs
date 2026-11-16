// Parse the text (pdftotext -layout) of an official SRO entry list: per car number, the drivers and the category printed beside each
// (SRO "CAT" P/G/S/B, British GT "GRADE", IGTC "Platinum/Gold/Silver/Bronze"). Only what is printed is taken. A list that prints no
// category per driver (British GT 2020-2022: car class only) gives the driver names per car (`names`), read by the "DRIVER n" columns.
// Used by fetch-sro-entry-pdfs.mjs (Actions) and tests.
const CAT = /^(P|G|S|B|PLATINUM|PLATINIUM|GOLD|SILVER|BRONZE)$/i;
const catOf = t => ({p: 'P', platinum: 'P', platinium: 'P', g: 'G', gold: 'G', s: 'S', silver: 'S', b: 'B', bronze: 'B'})[t.toLowerCase()];
const NAT = /^[A-Z]{3}$/, NUM = /^#?\d{1,3}$/;
const isName = w => /^[\p{L}][\p{L}'’.\-]*[*,]?$/u.test(w) && !NAT.test(w); // "Farfus," (N24 lists: last name, first name)
const cells = l => [...l.matchAll(/\S+(?: \S+)*/g)].map(m => ({t: m[0], x: m.index, e: m.index + m[0].length}));

export function parseEntryText(txt) {
  const lines = txt.split('\n'), cars = [];
  // column of the car number: the "#" / "No" / "Car" header cell (SRO tables put a "QT" index before it); driver columns of the header
  // cupOnly: the header has DRIVER n columns and one category cell after them ("CATEGORY" = the car's cup, 2026 GTWC Europe drafts):
  // no rating per driver is printed, the words BRONZE/GOLD there are the cup, never a driver's rating
  let numCol = null, drvCols = null, cupOnly = false;
  for (const l of lines) {
    const h = /(^|\s)(#|No\.?|Nr\.?|Car|N°)(\s|$)/.exec(l);
    if (h && /driver/i.test(l)) { const hash = l.indexOf('#'); numCol = hash >= 0 ? hash : h.index + h[1].length;
      const hc = cells(l); drvCols = hc.map((c, i) => /^DRIVER ?\d/i.test(c.t) ? {l: i ? (hc[i - 1].e + c.x) / 2 : 0, r: i + 1 < hc.length ? (c.e + hc[i + 1].x) / 2 : 1e9} : null).filter(Boolean);
      const catCells = [...l.matchAll(/\S+/g)].map(m => ({t: m[0], x: m.index})).filter(c => /^(CAT\.?|CATEGORY|CATEGORIE|categorisa\w*|GRADE|RATING)$/i.test(c.t)), lastDrv = Math.max(...hc.filter(c => /^DRIVER ?\d/i.test(c.t)).map(c => c.x));
      cupOnly = drvCols.length >= 2 && catCells.length === 1 && catCells[0].x > lastDrv; if (cupOnly) drvCols.at(-1).r = catCells[0].x - 1; continue; }
    const toks = [...l.matchAll(/\S+/g)].map(m => ({t: m[0], x: m.index}));
    const nums = toks.filter(o => NUM.test(o.t)); if (!nums.length) continue;
    const num = numCol != null ? nums.reduce((a, o) => Math.abs(o.x - numCol) < Math.abs(a.x - numCol) ? o : a) : nums[0];
    if (numCol != null && Math.abs(num.x + num.t.length - 1 - numCol) > 8 && Math.abs(num.x - numCol) > 8) continue;
    const cats = toks.filter(o => CAT.test(o.t));
    if (!cupOnly && cats.length >= 1 && cats.length <= 6) {
      const drivers = [];
      // "-" in a category column = no category printed for that driver: kept as unknown (the car's line-up is then not complete)
      toks.forEach((o, k) => { const none = o.t === '-' && k > 0 && NAT.test(toks[k - 1].t); if (!CAT.test(o.t) && !none) return;
        // the name is the run of name words before the category (nationality codes in between are skipped)
        let j = k - 1; while (j >= 0 && NAT.test(toks[j].t)) j--;
        const w = []; while (j >= 0 && isName(toks[j].t) && !CAT.test(toks[j].t) && w.length < 4 && (o.x - toks[j].x) < 60 + 12 * w.length) { w.unshift(toks[j].t); j--; }
        if (w.length >= 2) drivers.push({name: w.join(' ').replace(/[*,]/g, ''), cat: none ? null : catOf(o.t)}); });
      if (drivers.length) { cars.push({car: num.t.replace('#', ''), drivers}); continue; }
    }
    // no category printed: names by the driver columns of the header
    if (drvCols?.length >= 2) { const names = drvCols.map(c => toks.filter(o => { const m = o.x + o.t.length / 2; return m >= c.l && m < c.r && isName(o.t); }).map(o => o.t.replace(/[*,]/g, '')).join(' ')).filter(n => n.split(' ').length >= 2);
      if (names.length >= 2) cars.push({car: num.t.replace('#', ''), names}); }
  }
  return cars;
}
