// Parse the text (pdftotext -layout) of an official SRO entry list: per car number, the drivers and the category printed beside each
// (SRO "CAT" P/G/S/B, British GT "GRADE", IGTC "Platinum/Gold/Silver/Bronze"). Only what is printed is taken; a row whose drivers
// carry no category is skipped. Used by fetch-sro-entry-pdfs.mjs (Actions) and tests.
const CAT = /^(P|G|S|B|PLATINUM|PLATINIUM|GOLD|SILVER|BRONZE)$/i;
const catOf = t => ({p: 'P', platinum: 'P', platinium: 'P', g: 'G', gold: 'G', s: 'S', silver: 'S', b: 'B', bronze: 'B'})[t.toLowerCase()];
const NAT = /^[A-Z]{3}$/, NUM = /^#?\d{1,3}$/;
const isName = w => /^[\p{L}][\p{L}'’.\-]*$/u.test(w) && !NAT.test(w);

export function parseEntryText(txt) {
  const lines = txt.split('\n'), cars = [];
  // column of the car number: the "#" / "No" / "Car" header cell (SRO tables put a "QT" index before it)
  let numCol = null;
  for (const l of lines) {
    const h = /(^|\s)(#|No\.?|Nr\.?|Car ?#?|N°)(\s|$)/.exec(l);
    if (h && /driver/i.test(l)) { numCol = h.index + h[1].length; }
    const toks = [...l.matchAll(/\S+/g)].map(m => ({t: m[0], x: m.index}));
    const cats = toks.filter(o => CAT.test(o.t)); if (cats.length < 1 || cats.length > 5) continue;
    const nums = toks.filter(o => NUM.test(o.t)); if (!nums.length) continue;
    const num = numCol != null ? nums.reduce((a, o) => Math.abs(o.x - numCol) < Math.abs(a.x - numCol) ? o : a) : nums[0];
    if (numCol != null && Math.abs(num.x - numCol) > 6) continue;
    const drivers = [];
    toks.forEach((o, k) => { if (!CAT.test(o.t)) return;
      // the name is the run of name words before the category (nationality codes in between are skipped)
      let j = k - 1; while (j >= 0 && NAT.test(toks[j].t)) j--;
      const w = []; while (j >= 0 && isName(toks[j].t) && !CAT.test(toks[j].t) && w.length < 4 && (o.x - toks[j].x) < 60 + 12 * w.length) { w.unshift(toks[j].t); j--; }
      if (w.length >= 2) drivers.push({name: w.join(' '), cat: catOf(o.t)}); });
    if (drivers.length) cars.push({car: num.t.replace('#', ''), drivers});
  }
  return cars;
}
