// Report-only source transcription. NOT an input to calibration or runtime.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SPEED_SOURCES = Object.freeze([
  Object.freeze({
    id: 'fia-monza-q-2025', series: 'F1', event: 'Monza 2025 qualifying',
    url: 'https://www.fia.com/sites/default/files/2025_16_ita_f1_q0_timing_qualifyingsessionmaximumspeeds_v01_0.pdf',
    // [car number, SPEED TRAP session maximum km/h], all entrants, PDF column 1.
    observations: Object.freeze([
      [27, 355.9], [5, 355.9], [44, 352.7], [16, 350.9], [6, 350.1],
      [14, 349.6], [87, 349.5], [55, 349.1], [1, 348.6], [22, 348.4],
      [63, 348.1], [31, 348.0], [12, 347.7], [18, 346.9], [23, 345.9],
      [81, 345.8], [10, 345.7], [4, 345.7], [43, 345.0], [30, 344.9],
    ].map(Object.freeze)),
  }),
  Object.freeze({
    id: 'alkamel-lemans-hp2-hypercar-2025', series: 'WEC Hypercar',
    event: 'Le Mans 2025 Hyperpole 2',
    url: 'https://fiawec.alkamelsystems.com/Results/14_2025/04_LE%20MANS/600_FIA%20WEC/202506122140_Hyperpole%202%20HYPERCAR/14_BestTopSpeed_Hyperpole%202%20HYPERCAR.PDF',
    // [car number, Top 1 km/h], not Top 2–5 (which include slow/out laps).
    observations: Object.freeze([
      [5, 338.1], [50, 338.1], [4, 337.0], [36, 337.0], [311, 334.9],
      [15, 333.9], [20, 333.9], [8, 331.8], [12, 331.8], [38, 329.8],
    ].map(Object.freeze)),
  }),
]);

export function sampleSdKph(values) {
  if (!Array.isArray(values)) throw new TypeError('Speeds must be an array');
  let n = 0, mean = 0, m2 = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new TypeError('Every speed must be a finite positive number in km/h');
    }
    n++;
    const delta = value - mean;
    mean += delta / n;
    m2 += delta * (value - mean);
  }
  return n < 2 ? null : Math.sqrt(m2 / (n - 1));
}

export function raceDataEvidence() {
  return SPEED_SOURCES.map(({observations, ...source}) => ({
    ...source,
    n: observations.length,
    statistic: 'sample SD of one session maximum per car/driver',
    straightProxySdKph: sampleSdKph(observations.map(([, speed]) => speed)),
    apexSdKph: null,
    withinDriverLapSdKph: null,
    limitation: 'Cross-car/driver session-max spread; not pure driver noise, same-lap straight-end speed or repeatability. No model input.',
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(raceDataEvidence(), null, 2));
}
