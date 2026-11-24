// Step 1 of the unseen-season gate (claude/gate-geometry-f1-unseen-seasons-prereg-2026-11-24.md, rev 2), WORKING COPY ONLY (never
// committed; run in the gate jobs before apply.mjs): the eligible F1 2022 qualifying laps of ti-2022.mjs take the place of the
// 2023–26 F1 data, in the 2025 season slot. Why the 2025 slot: calibrate, the page, level C, forward-chaining and the corner check
// all know the seasons 2025/2026 only; PRIOR[2022] = {...PRIOR[2023]} (central 2026-11-24) equals PRIOR[2025] in every value but the
// label (cars.js: PRIOR[2023] = {...PRIOR[2025]}), checked below. So the gate fits LAPSIM_SEASONS=2025 = the 2022 laps.
// - .cache/lapsim/traces.json: only the 2022 traces, year 2025, dates moved +3 years (the same share of the season for tau);
// - worker/lapsim/f1-zones-data.js: the 2025 slot of each eligible track = the 2022 zones chosen in step 0 (source kept);
// - worker/lapsim/f1-real-telemetry-data.js: 2025 = the 2022 pole lap, other seasons removed; f1-wet-quali-data.js: 2025/2026 removed;
// - worker/lapsim/f1-poles-data.js: 2025 = the 2022 pole (driver, lap, sectors), other 2025 entries removed.
// Measured data is only moved, not changed. Usage: LAPSIM_F1_2022=on node scripts/sim/geom-indep/apply-2022.mjs <ti-2022.json> [cache]
import {readFileSync, writeFileSync} from 'node:fs';
import {PRIOR} from '../../../worker/lapsim/cars.js';

if (process.env.LAPSIM_F1_2022 !== 'on') { console.log('LAPSIM_F1_2022 not on: nothing changed'); process.exit(0); }
const D = JSON.parse(readFileSync(process.argv[2], 'utf8')), CACHE = process.argv[3] || '.cache/lapsim', SLOT = '2025';
const noLabel = p => JSON.stringify({...p, label: undefined});
if (noLabel(PRIOR[2023]) !== noLabel(PRIOR[2025])) throw new Error('PRIOR[2023] differs from PRIOR[2025]: the 2025 slot is not PRIOR[2022]');
const ok = new Set(D.eligible), shift = d => d && `${+d.slice(0, 4) + 3}${d.slice(4)}`;
const traces = D.traces.filter(t => ok.has(t.track)).map(t => ({...t, year: +SLOT, date: shift(t.date), srcYear: t.year}));
writeFileSync(`${CACHE}/traces.json`, JSON.stringify(traces));
const rewrite = (f, name, fn) => { const s = readFileSync(f, 'utf8'), re = new RegExp(`(export const ${name} ?= ?)([\\s\\S]*?);\\n`), m = re.exec(s);
  const v = fn(JSON.parse(m[2])); writeFileSync(f, s.replace(re, () => `${m[1]}${JSON.stringify(v)};\n`)); };
// the 2025 race-control state ('real': low grip, DRS off) is not carried to 2022 (no 2022 state is read: DRS on, normal grip)
rewrite('worker/lapsim/f1-zones-data.js', 'lapsimF1Zones', z => { for (const id of ok) { const {real, ...q} = D.zones[id]; (z.tracks[id] ||= {})[SLOT] = {...q, year: +SLOT, srcYear: 2022}; } return z; });
// the page's 2025 sector correction (scenario.js fix) reads the 2025 real pole sectors: 2022 pole instead, other 2025 entries removed
rewrite('worker/lapsim/f1-poles-data.js', 'lapsimF1Poles', P => { for (const id of Object.keys(P)) delete P[id][SLOT];
  for (const t of traces.filter(t => t.position === 1)) (P[t.track] ||= {})[SLOT] = {driver: t.src.split(' ').at(-3), number: String(t.driver_number), lap: t.lap_seconds, sectors: t.sectors, seg: 'Q3', srcYear: 2022}; return P; });
rewrite('worker/lapsim/f1-real-telemetry-data.js', 'lapsimF1RealTel', () => Object.fromEntries([...ok].map(id => [id, {[SLOT]: D.realTel[id]}])));
rewrite('worker/lapsim/f1-wet-quali-data.js', 'lapsimF1WetQuali', w => { for (const id of Object.keys(w)) { delete w[id]['2025']; delete w[id]['2026']; } return w; });
console.log(`2022 laps in the ${SLOT} slot: ${traces.length} traces on ${ok.size} tracks (${[...ok].join(', ')})`);
