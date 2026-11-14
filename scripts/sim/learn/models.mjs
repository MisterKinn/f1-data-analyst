// Car model identity from the VEHICLE text of a timing feed. Owner rule: every series is learned per car model, and a base
// model and its Evo kit are two cars (the page shows the base model with an Evo tick box). Nothing is guessed: no text -> null.
const up = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9.]+/g, ' ').trim();
// [pattern on the cleaned text, canonical base name]. First match wins. Generations that share a name are split by season below.
const BASE = [[/VALKYRIE/, 'Aston Martin Valkyrie'], [/499P/, 'Ferrari 499P'], [/GR010|TR010/, 'Toyota GR010 Hybrid'], [/9X8/, 'Peugeot 9X8'], [/GLICKENHAUS/, 'Glickenhaus 007'], [/VANWALL|VANDERVELL/, 'Vanwall Vandervell 680'],
  [/ISOTTA|TIPO ?6/, 'Isotta Fraschini Tipo6-C'], [/A480/, 'Alpine A480'], [/A424/, 'Alpine A424'], [/PORSCHE 963/, 'Porsche 963'], [/CADILLAC V|V SERIES|VSERIES|V LMDH/, 'Cadillac V-Series.R'], [/M HYBRID/, 'BMW M Hybrid V8'],
  [/ARX 06/, 'Acura ARX-06'], [/SC63/, 'Lamborghini SC63'], [/GMR 001/, 'Genesis GMR-001'],
  [/NSX/, 'Acura NSX GT3'], [/VANTAGE/, 'Aston Martin Vantage GT3'], [/R8/, 'Audi R8 LMS GT3'], [/M4/, 'BMW M4 GT3'], [/M6/, 'BMW M6 GT3'], [/C8.R GTD/, 'Chevrolet Corvette C8.R GTD'], [/Z06/, 'Chevrolet Corvette Z06 GT3.R'],
  [/296/, 'Ferrari 296 GT3'], [/488 GT3/, 'Ferrari 488 GT3'], [/MUSTANG/, 'Ford Mustang GT3'], [/TEMERARIO/, 'Lamborghini Temerario GT3'], [/HURACAN/, 'Lamborghini Huracan GT3'], [/RC ?F/, 'Lexus RC F GT3'],
  [/720S/, 'McLaren 720S GT3'], [/AMG/, 'Mercedes-AMG GT3'], [/911 GT3 ?R/, 'Porsche 911 GT3 R'], [/ORECA|07 GIBSON/, 'Oreca 07'], [/LIGIER JS ?P2|JSP217/, 'Ligier JS P217']];
export function modelOf(vehicle, season, cls = '') {
  const t = up(vehicle); if (!t) return null;
  if (/\b(GT4|GT2|GTE|RSR|CUP|TCR|SUPER TROFEO|CHALLENGE|TROFEO)\b/.test(t)) return null; // other categories that share a model name
  // GT3 names need a GT3 word in the text: "Ford Mustang GT" (NASCAR), "Toyota GR86" (R8 inside), "BMW M4" (touring) are other cars
  const hit = BASE.find(([re, b]) => re.test(t) && (!/GT3/.test(b) || /GT3|GTD\b/.test(t))); if (!hit) return null; let base = hit[1];
  if (/GT3|GTD|LMGT3|^GT$/.test(up(cls)) === false && /GT3/.test(base)) return null;               // a GT3 name in a non-GT3 class (GTE Vantage AMR, Cup cars)
  if (base === 'Porsche 911 GT3 R') base += /992/.test(t) || (!/991/.test(t) && season >= 2023) ? ' (992)' : ' (991.2)';
  if (base === 'Aston Martin Vantage GT3' && season <= 2023) base = 'Aston Martin Vantage AMR GT3 (2019)';
  const e = t.match(/\bEVO ?(II|2)?\b/), evo = e ? (e[1] ? 'evo2' : 'evo') : null;
  return {base, evo, key: base + (evo ? ' +' + evo.toUpperCase() : '')};
}
