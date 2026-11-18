// Typical weather presets (W4 climatology, docs/lapsim-climate.md), shared by the /simulation page and lapsim_simulate:
// used only when the car has no real session at this track. Track temperature from the fitted rule (tracktemp-data.js).
import {lapsimClimate, lapsimClimateMeta} from './climate-data.js';
import {lapsimTrackTemp} from './tracktemp-data.js';

// car → series key of the presets (GT3 car models by their BoP body)
export const climateSeries = car => !car.series ? 'f1' : car.series === 'gt3' ? ({'gt3-sro': 'gtwc', 'gt3-imsa': 'imsa', 'gt3-aco': 'wec', 'gt3-dtm': 'dtm'})[car.cls] : car.series;

export function climateFor(id) {
  const c = lapsimClimate[id], M = lapsimClimateMeta, T = lapsimTrackTemp;
  if (!c) return null;
  const presets = Object.fromEntries(Object.entries(c.presets).map(([k, p]) => [k, {...p, w: {airTempC: p.air[1], humidityPct: p.rh[1], pressureHpa: p.p[1], windSpeed: p.wind[1], windFromDeg: p.dir,
    trackTempC: Math.round((p.air[1] + T.a + T.k * p.sw) * 10) / 10}}]));
  return {presets, main: c.main, bias: M.airBias, rms: M.airRms, ttErr: T.test.rmsC};
}

// the preset for one car: its series' slot here, else the main series here
export function climatePreset(id, car) {
  const c = climateFor(id); if (!c) return null;
  const own = c.presets[climateSeries(car)], p = own || c.presets[c.main];
  return p ? {...p, via: own ? null : p.series} : null;
}
