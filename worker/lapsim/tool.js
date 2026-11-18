// lapsim_simulate: the lap simulator as a connector tool. Same engine, tracks and calibration as
// the /simulation page (worker/lapsim/scenario.js), so the page and the tool agree.
import {withZones, simulateWithOptions, slotOf, puRampOf, PU_RAMP} from './zones.js';
import {lapsimF1Zones} from './f1-zones-data.js';
import {lapsimKernel} from './kernel.js';
import {lapsimAllTracks as lapsimTracks} from './tracks.js';
import {lapsimCalibration} from './calibration-data.js';
import {RULE_CHANGES} from './cars.js';
import {TRACK_NAMES, resolveTrack} from './names.js';
import {carsFor, realConditions, latestChanges, fittedYear, SERIES_CARS, CAR_ORDER, raceRecords} from './scenario.js';
import {rechargeLimitMJ} from './energy-limits.js';
import {lapsimLearned} from './learned-data.js';
import {evolutionCoeffs, evolutionDelta, evolutionCurve} from './evolution.js';
import {wetGap} from './wet-gap.js';
import {lapsimWetGap} from './wet-gap-data.js';
import {climatePreset} from './climate.js';

const K = lapsimKernel();
const SITE = 'https://kongboda-motorsports.vercel.app';
const CARS = ['2019', '2025', '2026', '2027', '2028', 'wec-lmh', 'wec-lmdh', 'wec-lmgt3', ...Object.keys(SERIES_CARS), ...CAR_ORDER.filter(k => k.startsWith('gt3-') || k.startsWith('fe-'))];
const ro = {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false};
const num = (min, max, description) => ({type: 'number', minimum: min, maximum: max, description});

export const LAPSIM_TOOLS = [{name: 'lapsim_simulate',
  description: 'Kongboda lap simulator: a qualifying lap worked out by a quasi-steady-state model (TUM method) on the real driving line built from OpenF1 qualifying car positions. Cars: F1 2019 (TUM base), 2025 and 2026 (fitted to real pole laps), 2027 and 2028 (projected from the ratified power-unit changes and historical development); WEC Hypercar and LMGT3 class cars (fitted to Al Kamel lap times and speed traps). Every result carries a one-sigma error range and a confidence label from a holdout test. Inputs override the real qualifying weather: air and track temperature, humidity, pressure (or altitude), wind speed and direction; FIA "Changes to the circuit" (resurfacing, bumps, kerbs) can be switched on. Returns lap and sector times, top and lowest speed, corner minimum speeds, 2026 energy use, what limits the lap, air density and the model error against the real pole. Call without track to list tracks.',
  inputSchema: {type: 'object', properties: {
    track: {type: 'string', maxLength: 60, description: 'Track id, name or Grand Prix, e.g. "mexico-city", "Monza", "COTA", "멕시코시티".'},
    car: {type: 'string', enum: CARS, description: 'F1 generation (2019 TUM base, 2025, 2026, 2027, 2028), WEC class car (wec-lmh, wec-lmdh, wec-lmgt3), a GT3 car model learned from real laps (gt3-...; base model and Evo kit are separate cars), a Formula E rule set (fe-gen4 prior, fe-gen3evo, fe-gen3, fe-gen2; learned from Al Kamel laps), or a provisional series car (imsa-gtp = LMDh car; imsa-gtd/gtdpro, elms-lmgt3, alms-gt3, gtwc-gt3, dtm-gt3, igtc-gt3, nur-gt3, macau-gt3 = LMGT3 car; raced sessions reproduce the real best lap). Default 2026.'},
    compare_car: {type: 'string', enum: CARS, description: 'Second car on the same track and conditions.'},
    air_temp_c: num(-10, 50, 'Air temperature (°C).'),
    track_temp_c: num(0, 70, 'Track temperature (°C).'),
    humidity_pct: num(0, 100, 'Relative humidity (%).'),
    pressure_hpa: num(600, 1060, 'Station air pressure (hPa). Preferred over altitude.'),
    altitude_m: num(-100, 4000, 'Altitude (m) when pressure is unknown; pressure is then estimated with the standard atmosphere.'),
    wind_speed_ms: num(0, 30, 'Wind speed (m/s).'),
    wind_from_deg: num(0, 360, 'Direction the wind blows from (degrees, 0 = north).'),
    apply_fia_changes: {type: 'boolean', description: 'Apply the lap-relevant items of the latest race director\'s "Changes to the circuit" list.'},
    change_strength: num(0, 2, 'Scale of the assumed effect of FIA changes (1 = default assumption).'),
    session_type: {type: 'string', enum: ['practice', 'qualifying', 'sprint', 'race'], description: 'Track evolution: session type (picks the fitted coefficients). Giving any evolution input adds an "evolution" block; the lap result itself is unchanged.'},
    session_minute: num(0, 360, 'Track evolution: minute of the session to predict (default: session end).'),
    rubber_gain_pct: num(0, 5, 'Track evolution: total lap-time gain from rubber over the session (%); overrides the measured/fitted curve.'),
    saturation_min: num(1, 300, 'Track evolution: minutes for the rubber gain to mostly saturate.'),
    track_wetness_start: num(0, 1, 'Track evolution: wetness at the session start (0 dry, 1 fully wet).'),
    drying_time_min: num(0, 300, 'Track evolution: drying time constant (min; 0 = does not dry).'),
    tyre: {type: 'string', enum: ['slick', 'inter', 'wet'], description: 'Track evolution: tyre type on a wet track. Intermediates exist only in F1; WEC Hypercar and LMGT3 have slicks and wets only (inter is treated as wet there).'},
    tyre_warmup_laps: num(0, 5, 'Track evolution: laps after the out-lap before the tyre is at its best.'),
    car_model: {type: 'string', maxLength: 20, description: 'F1 inter/wet: real car model (e.g. "RB18") to replay its measured wet gap in a past session of this track (with wet_season and session_type).'},
    wet_season: {type: 'integer', minimum: 2018, maximum: 2026, description: 'F1 inter/wet: season of the past wet session to replay (default: the car year).'},
    wet_session: {type: 'string', maxLength: 20, description: 'F1 inter/wet: exact past session name to replay, e.g. "Practice 1", "Sprint Shootout" (default: the latest wet session of session_type).'},
    torque_curve: {type: 'array', maxItems: 40, items: {type: 'array', items: {type: 'number'}, minItems: 2, maxItems: 2}, description: 'Engine torque curve as [rpm, Nm] pairs (ascending rpm). Replaces the preset shape of the car; power is still capped at the car\'s regulation or BoP power. Give with gear_ratios.'},
    power_curve_kw: {type: 'array', maxItems: 40, items: {type: 'array', items: {type: 'number'}, minItems: 2, maxItems: 2}, description: 'Alternative to torque_curve: [rpm, kW] pairs.'},
    gear_ratios: {type: 'array', minItems: 1, maxItems: 10, items: {type: 'number', minimum: 0.3, maximum: 30}, description: 'Gearbox ratios, 1st to top (overall ratios when final_drive is not given).'},
    final_drive: num(0.5, 15, 'Final drive ratio (default 1: gear_ratios are overall ratios).'),
    tyre_radius_m: num(0.2, 0.5, 'Rolling tyre radius (m) for the gearing.'),
    rpm_limit: num(1000, 25000, 'Rev limit (rpm); default the last point of the curve.'),
    engine_power_kw: num(50, 1500, 'Engine power cap (kW) replacing the car\'s regulation or BoP value.'),
    drag_cda: num(0.2, 3, 'Drag area CdA (m²) replacing the car\'s value (low-drag mode scales with it).'),
    downforce_cla: num(0, 8, 'Downforce area ClA (m²) replacing the car\'s value (low-drag mode scales with it).'),
    straight_mode: {type: 'string', enum: ['normal', 'alt', 'off'], description: 'F1 2026+: Straight Mode zone set. normal (default) = the FIA activation zones; alt = the Low Grip activation zones of the FIA map (Low Grip Conditions: partial activation only, some zones off); off = no Straight Mode.'},
    overtake: {type: 'boolean', description: 'F1 2026+: Overtake available (default true; C5.2.8 ii power curve, used where it gains time).'},
    drs: {type: 'boolean', description: 'F1 2025: DRS enabled (default true).'},
  }, additionalProperties: false}, annotations: ro}];

export const LAPSIM_INSTRUCTIONS = ' LAP SIMULATOR: for what-if questions about lap time (F1 car generation 2019/2025/2026/2027/2028 or WEC Hypercar/LMGT3, air density or altitude, temperature, humidity, wind, FIA resurfacing or kerb changes, track evolution over a session: rubber, drying, tyre warm-up), call lapsim_simulate. Report its numbers as provisional model estimates with the error range, confidence label and assumptions it returns, keep real and simulated times apart, and never present them as a prediction of a real session result. Show the conditions used (with their sources) and link the /simulation page it returns.';

const r3 = x => Math.round(x * 1000) / 1000;
const fmt = s => { const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
const carKey = c => c === '2019' ? 'base2019' : c;
const withGrip = (tr, g) => ({...tr, mu: Float64Array.from(tr.mu, m => m * g)});
// learned lap-time factor (docs/lapsim-learn.md): lap and sector times scale, the speed trace stays the class car's
const scaled = (r, f) => !f || f === 1 ? r : {...r, lapTime: r.lapTime * f, time: Float64Array.from(r.time, t => t * f)};

function summary(res, d, car) {
  const n = res.v.length, share = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) share[res.limit[i]] += (i + 1 < n ? res.time[i + 1] : res.lapTime) - res.time[i];
  const pct = x => Math.round(x / res.lapTime * 1000) / 10;
  const corners = (d.corners || []).map(c => {
    const i0 = Math.round(c.s / d.ds); let m = Infinity;
    for (let k = -12; k <= 12; k++) m = Math.min(m, res.v[((i0 + k) % n + n) % n]);
    return {turn: `T${c.number}${c.letter || ''}`, min_kph: Math.round(m * 3.6)};
  });
  return {lap_time: fmt(res.lapTime), lap_seconds: r3(res.lapTime), sectors_s: res.sectors?.map(r3) ?? null,
    top_speed_kph: Math.round(res.vMaxKph), lowest_speed_kph: Math.round(res.vMinKph),
    energy: car.ers?.pMax ? {deployed_mj: r3(res.energy.deployJ / 1e6), budget_mj: r3(res.energy.budgetJ / 1e6), recovered_mj: r3(res.energy.regenJ / 1e6), recharge_limit_mj: res.energy.rechargeMaxJ != null ? r3(res.energy.rechargeMaxJ / 1e6) : null,
      deploy_cutoff_kph: res.energy.cutoffKph ? Math.round(res.energy.cutoffKph) : null} : null,
    limited_by_pct_of_lap: {cornering_grip: pct(share[0]), traction: pct(share[1]), power: pct(share[2]), braking: pct(share[3])}, corners};
}

const selKey0 = args => carKey(args.car || '2026');
export function simulate(args = {}) {
  const ids = Object.keys(lapsimTracks).sort();
  if (!ids.length) return {status: 'unavailable', message: 'Track and calibration data are still being built.'};
  const id = args.track ? resolveTrack(args.track, ids) : null;
  if (!id) return {status: args.track ? 'track_not_found' : 'tracks', tracks: ids.map(k => ({id: k, name: TRACK_NAMES[k]?.[1] || k}))};
  const d = lapsimTracks[id], base = K.trackFromData(d), cars = carsFor(id), conds = realConditions(id);
  const selKey = carKey(args.car || '2026'), sel = cars[selKey] = {...cars[selKey0(args)]};
  // user powertrain and aero (bug report 2026-11-15): torque curve, gears, power, drag and downforce replace the car's values
  const given = [];
  if (args.torque_curve || args.power_curve_kw || args.gear_ratios || Number.isFinite(args.engine_power_kw) || Number.isFinite(args.drag_cda) || Number.isFinite(args.downforce_cla)) {
    const c = {...sel.car}, cv = args.torque_curve || args.power_curve_kw;
    if (cv) { const pts = [...cv].filter(p => p[0] > 0 && p[1] > 0).sort((a, b) => a[0] - b[0]); if (pts.length >= 2) { c.engine = {rpm: pts.map(p => p[0]), [args.torque_curve ? 'Nm' : 'kW']: pts.map(p => p[1]), rpmMax: args.rpm_limit ?? pts.at(-1)[0]}; given.push('engine curve'); } }
    else if (Number.isFinite(args.rpm_limit) && c.engine) c.engine = {...c.engine, rpmMax: args.rpm_limit};
    if (args.gear_ratios) { c.gears = [...args.gear_ratios]; c.finalDrive = args.final_drive ?? 1; given.push('gear ratios'); } else if (Number.isFinite(args.final_drive)) c.finalDrive = args.final_drive;
    if (Number.isFinite(args.tyre_radius_m)) c.tyreRadius = args.tyre_radius_m;
    if (Number.isFinite(args.engine_power_kw)) { c.pIce = args.engine_power_kw * 1e3; given.push('engine power'); }
    if (cv && args.torque_curve && !Number.isFinite(args.engine_power_kw)) c.pIce = Math.max(c.pIce, Math.max(...c.engine.Nm.map((T, i) => T * c.engine.rpm[i] * 2 * Math.PI / 60))); // the curve itself sets the power when no cap is given
    if (Number.isFinite(args.drag_cda)) { const f = args.drag_cda / c.cdA; c.cdA = args.drag_cda; if (c.cdALow) c.cdALow *= f; given.push('drag'); }
    if (Number.isFinite(args.downforce_cla)) { const f = args.downforce_cla / c.clA; c.clA = args.downforce_cla; if (c.clALow) c.clALow *= f; given.push('downforce'); }
    // the real-lap correction of the unchanged car stays (real lap minus its simulated lap), so the change shows as a difference from the real lap
    cars.__base = {...sel}; sel.car = c; if (sel.fix) sel.fix = {...sel.fix, ref: '__base'};
  }
  // weather: the real qualifying session of the car's season (else the latest), overridden by inputs
  const own = sel.series ? selKey : String(sel.year);
  // no real session of this car here (future round, projected car, series not raced here): typical weather of its series' slot (same as the page)
  const clim = conds[own] ? null : climatePreset(id, sel);
  const realYear = conds[own] ? own : clim ? null : conds['2026'] ? '2026' : Object.keys(conds)[0];
  const real = clim ? clim.w : realYear ? conds[realYear] : null;
  const realSrc = !real ? null : clim ? `typical ${clim.m}/${clim.h}:00 local${clim.hourAssumed ? ' (hour assumed)' : ''}${clim.via ? `, ${clim.via} slot` : ''}: ERA5 2016-2025 median via Open-Meteo (CC BY 4.0, contains modified Copernicus Climate Change Service information); air p10-p90 ${clim.air[0] ?? '–'}-${clim.air[2] ?? '–'} °C, rain probability ${clim.rain}%, ERA5 air error vs trackside RMS 2.25 °C` : real.source && real.source !== 'timing71' && realYear === own ? `real ${real.year} ${real.event} (${real.source}, session mean weather)` // extra circuit: the source is stored with the lap
    : real.source === 'timing71' && realYear === own ? `real ${real.year} ${sel.series.toUpperCase()} qualifying (Timing71 weather, session median)` : sel.series && realYear === own ? `real ${real.year} WEC qualifying/Hyperpole (Al Kamel weather, session mean)` : `real ${realYear} F1 qualifying (OpenF1 weather, session mean)`;
  const pick = (given, key, fallback) => Number.isFinite(given) ? [given, 'given'] : Number.isFinite(real?.[key]) ? [real[key], realSrc] : [fallback, 'default'];
  const [airTempC, airSrc] = pick(args.air_temp_c, 'airTempC', 25), [trackTempC, trackSrc] = pick(args.track_temp_c, 'trackTempC', 35);
  const [humidityPct, humSrc] = pick(args.humidity_pct, 'humidityPct', 50), [windSpeed, windSrc] = pick(args.wind_speed_ms, 'windSpeed', 0);
  const [windFromDeg, windDirSrc] = pick(args.wind_from_deg, 'windFromDeg', 0);
  let pressureHpa, pressureSrc;
  if (Number.isFinite(args.pressure_hpa)) [pressureHpa, pressureSrc] = [args.pressure_hpa, 'given'];
  else if (Number.isFinite(args.altitude_m)) [pressureHpa, pressureSrc] = [K.pressureFromAltitude(args.altitude_m), `estimated from ${args.altitude_m} m altitude (standard atmosphere)`];
  else [pressureHpa, pressureSrc] = pick(undefined, 'pressureHpa', 1013.25);
  // per-event ERS recharge limit (2026 values; 2027/2028 reuse them), ignored by older rule sets
  const rechargeMJ = rechargeLimitMJ(id, 2026);
  const w = {airTempC, trackTempC, humidityPct, pressureHpa, windSpeed, windFromDeg, rechargeMJ: rechargeMJ ?? undefined};
  const env = K.conditionsFromWeather(w);
  // FIA changes
  const ch = latestChanges(id);
  let track = base, applied = [];
  if (args.apply_fia_changes && ch?.changes?.length) {
    const r = K.applyTrackChanges(base, ch.changes.filter(c => c.affectsLap), d.corners || [], {strength: args.change_strength ?? 1});
    track = r.track; applied = r.applied;
  }
  // sector correction on raced tracks (same rule as the /simulation page): real pole sectors minus the
  // reference car's simulated sectors in the real pole weather, added to every result for that car
  const secOf = r => { if (d.sectors?.length !== 2) return null; const i1 = Math.round(d.sectors[0] / d.ds), i2 = Math.round(d.sectors[1] / d.ds); return [r.time[i1], r.time[i2] - r.time[i1], r.lapTime - r.time[i2]]; };
  const corrOf = c => {
    if (c.fix?.lap != null) { // lap-level correction (series whose sector lines may differ from these): spread by sector share
      const ref = cars[c.fix.ref], fw = Object.fromEntries(Object.entries(c.fix.weather || {}).filter(([, v]) => Number.isFinite(v)));
      const r = K.simulateLap(withGrip(withZones(K, d, base, ref), ref.grip || 1), ref.car, K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0, ...fw}));
      const rs = scaled(r, ref.timeScale), ss = secOf(rs) || [rs.lapTime, 0, 0], dl = c.fix.lap - rs.lapTime; return ss.map(x => dl * x / rs.lapTime);
    }
    if (!c.fix || d.sectors?.length !== 2) return null;
    const ref = cars[c.fix.ref], fw = Object.fromEntries(Object.entries(c.fix.weather || {}).filter(([, v]) => Number.isFinite(v)));
    const ss = secOf(K.simulateLap(withGrip(withZones(K, d, base, ref), ref.grip || 1), ref.car, K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0, ...fw, rechargeMJ: rechargeMJ ?? undefined})));
    return c.fix.real.map((x, i) => x - ss[i]);
  };
  // zone options (owner 2026-11-16); none given = the fitted lap, as before
  const opt = ['straight_mode', 'overtake', 'drs'].some(k => args[k] !== undefined) ? {sm: args.straight_mode || 'normal', ot: args.overtake !== false, drs: args.drs !== false} : null;
  const run = c => {
    // options run with the C5.12 rule; the fit's own setup (scale) without it until the fit includes it (same as the page)
    const envP = {...env, puRamp: puRampOf(d, id)}, sim = tr => K.simulateLap(withGrip(tr, c.grip || 1), c.car, envP), simFit = tr => K.simulateLap(withGrip(tr, c.grip || 1), c.car, PU_RAMP ? envP : env);
    const o = opt && simulateWithOptions(K, d, track, c, opt, sim, simFit);
    const r = scaled(o || simFit(withZones(K, d, track, c)), c.timeScale), k = corrOf(c), sec = secOf(r);
    return k && sec ? {...r, lapTime: r.lapTime + k[0] + k[1] + k[2], sectors: sec.map((x, i) => x + k[i]), sectorCorrection: k} : k ? {...r, lapTime: r.lapTime + k.reduce((a, b) => a + b, 0), sectorCorrection: k} : r;
  };
  const res = run(sel);
  const xc = d.quality?.check; // set on extra circuits only
  const lt = lapsimLearned?.tracks?.[id]; // real laps of every car model on this track (docs/lapsim-learn.md)
  const out = {status: 'ok', model: 'quasi-steady-state lap simulation (estimate, not a prediction of a real session)',
    track: {id, name: TRACK_NAMES[id]?.[1] || (xc ? `${d.name}, ${d.layout}` : id), length_m: Math.round(d.length || d.kappa.length * d.ds), corners: (d.corners || []).length,
      // an extra circuit says where its line came from and how it did in its check (docs/lapsim-tracks-extra.md)
      geometry: xc ? `${d.quality.evidence.planShape}; driven line: ${d.quality.evidence.drivenLine}` : 'driving line from OpenF1 qualifying car positions; corner numbers from official positions',
      ...(xc ? {check: d.fit ? `passed (${xc.mode}): ${xc.mode === 'learned' ? `held-out error ${xc.learned.heldOut.rmsPct} % with a track factor learned from ${xc.learned.heldOut.n} real laps` : `error ${xc.rmsPct} % on ${xc.n} real lap(s), no value from this track used`}` : d.warn} : {}),
      ...(lt ? {learned: `lap times learned from ${lt.events} real qualifying events here (every car model); class-best error with one event hidden: ${Object.entries(lt.errPct).map(([g, v]) => `${g} ${v} %`).join(', ')}`} : {})},
    car: {series: sel.series || 'f1', class: sel.cls || null, year: sel.year, kind: sel.kind, mass_kg: sel.car.mass, track_grip_factor: r3(sel.grip || 1)},
    conditions: {air_temp_c: r3(airTempC), track_temp_c: r3(trackTempC), humidity_pct: Math.round(humidityPct), pressure_hpa: Math.round(pressureHpa * 10) / 10,
      wind_speed_ms: r3(windSpeed), wind_from_deg: Math.round(windFromDeg),
      sources: {air_temp: airSrc, track_temp: trackSrc, humidity: humSrc, pressure: pressureSrc, wind_speed: windSrc, wind_direction: windDirSrc},
      air_density_kg_m3: r3(env.rho), density_vs_sea_level_pct: Math.round((env.rho / 1.225 - 1) * 1000) / 10,
      engine_power_factor: r3(env.iceFactor), tyre_grip_factor: r3(env.grip), wind_applied: !!base.heading && windSpeed > 0,
      main_straight_tailwind_ms: base.heading ? r3(K.tailwind(base.heading[2], windSpeed, windFromDeg)) : null},
    ...(!sel.series && sel.year ? {zones: (() => { const z = lapsimF1Zones?.tracks?.[id]?.[slotOf(lapsimF1Zones?.tracks?.[id], sel.year)]; return {kind: z?.kind || null, estimated: !!z?.est, count: z?.zones?.length ?? 0, document: z?.doc || null,
      options: opt ? (sel.year >= 2026 ? {straight_mode: opt.sm, overtake: opt.ot} : {drs: opt.drs}) : 'default (Normal zones, Overtake on / DRS on)',
      ...(z?.real ? {real_qualifying: z.real} : {})}; })()} : {}),
    result: {...summary(res, d, sel.car), ...(res.sectorCorrection ? {sector_correction_s: res.sectorCorrection.map(r3), sector_correction_note: 'real pole sectors minus the simulated ones in the real pole weather (track-specific model bias)'} : {})},
    uncertainty: {error_range_s: sel.unc?.pct ? r3(res.lapTime * sel.unc.pct / 100) : null, error_range_pct: sel.unc?.pct ?? null, confidence: sel.unc?.confidence,
      basis: sel.unc?.basis === 'fit' ? 'one-sigma lap-time error of the fit over the tracks this car was fitted on' : 'one-sigma error from the holdout test (tracks left out of the fit, predicted)', holdout_error_pct: sel.unc?.holdoutPct ?? null,
      note: 'projections add half the historical development range'}};
  // sensitivity table (common rule, as Formula Student teams report it): lap-time change for +10%
  const plus = (k, f) => { const c = structuredClone(sel.car); if (k === 'muY') { c.muX *= f; c.muY *= f; c.muXTrac = (c.muXTrac ?? c.muX) * f; } else if (k === 'clA') { c.clA *= f; c.clALow = (c.clALow ?? c.clA) * f; } else if (k === 'cdA') { c.cdA *= f; c.cdALow = (c.cdALow ?? c.cdA) * f; } else c[k] *= f; return c; };
  // the change is measured against the same bare simulation (no real-lap correction), scaled like the shown lap: comparing with the
  // corrected lap gave the correction's size, not the parameter's (bug report 2026-11-15: more drag made an LMDh faster)
  const bare = c => K.simulateLap(withGrip(track, sel.grip || 1), c, env).lapTime * (sel.timeScale || 1), b0 = bare(sel.car);
  out.sensitivity_s_per_plus_10pct = Object.fromEntries(['mass', 'muY', 'clA', 'cdA', 'pIce'].map(k => [k === 'muY' ? 'tyre_grip' : k === 'pIce' ? 'engine_power' : k === 'clA' ? 'downforce_clA' : k === 'cdA' ? 'drag_cdA' : 'mass',
    r3(bare(plus(k, 1.1)) - b0)]));
  // track evolution: only when asked, so the default output is unchanged
  if (['session_type', 'session_minute', 'rubber_gain_pct', 'saturation_min', 'track_wetness_start', 'drying_time_min', 'tyre', 'tyre_warmup_laps', 'car_model', 'wet_season', 'wet_session'].some(k => args[k] !== undefined)) {
    const se = sel.series === 'wec' ? 'wec' : 'f1', type = args.session_type || 'qualifying', c = evolutionCoeffs(se, id, type), qc = evolutionCoeffs(se, id, 'qualifying');
    const endOf = x => x.curve ? x.curve.at(-1)[0] : se === 'wec' ? (type === 'qualifying' ? 20 : 90) : 60;
    const formula = Number.isFinite(args.rubber_gain_pct) || Number.isFinite(args.saturation_min);
    const P = {...c, session: type, tyre: se === 'wec' && args.tyre === 'inter' ? 'wet' : args.tyre || 'slick', useCurve: !formula && !!c.curve, wetStart: args.track_wetness_start ?? 0, dryMin: args.drying_time_min ?? 20,
      warmupLaps: args.tyre_warmup_laps ?? 0, ...(Number.isFinite(args.rubber_gain_pct) ? {gainPct: args.rubber_gain_pct} : {}), ...(Number.isFinite(args.saturation_min) ? {tauMin: args.saturation_min} : {})};
    const end = args.session_minute ?? endOf(c);
    const lap0 = res.lapTime / (1 + evolutionDelta({...qc, session: 'qualifying', useCurve: !!qc.curve}, endOf(qc)));
    const curve = evolutionCurve(lap0, P, {to: Math.max(end, 1), step: Math.max(1, Math.round(end / 12))});
    // F1 intermediate / full wet: measured gap to the dry lap (W2-F); the evolution curve is not added on top (Gate G reject)
    const f1Wet = se === 'f1' && !sel.series && (args.tyre === 'inter' || args.tyre === 'wet');
    if (f1Wet) {
      const g = wetGap({track: id, compound: args.tyre, year: args.wet_season ?? sel.year, type, carModel: args.car_model, session: args.wet_session}), T = lapsimWetGap.test, lapW = res.lapTime * (1 + g.pct / 100);
      for (const p of curve.points) p.lap = lapW;
      out.wet = {tyre: args.tyre, gap_to_dry_pct: g.pct, lap: fmt(lapW), lap_s: r3(lapW), dry_lap_s: r3(res.lapTime),
        value_used: g.basis === 'car' ? `measured: ${g.carModel}, ${g.year} ${g.event} GP ${g.session} (${g.laps} laps, exact replay)` : g.basis === 'session' ? `measured: ${g.year} ${g.event} GP ${g.session}, mean of ${g.cars} cars (${g.laps} laps, exact replay)` : `constant ${args.tyre === 'wet' ? 'full wet' : 'intermediate'} gap (all F1 wet laps 2018-2026)`,
        source: 'measured gap to dry pace, TracingInsights 2018-26', held_out_error_pp: T.loo.mae, unseen_2026_error_pp: T.unseen2026.mae,
        ...(args.car_model && g.basis !== 'car' ? {car_model_note: `${args.car_model} has no measured ${args.tyre} laps in that session; ${g.basis === 'session' ? 'session mean' : 'constant'} used`} : {}),
        note: 'pp = percentage points of the dry lap. Wetness, drying time and rubber are not added: the measured gap already contains them.'};
    }
    out.evolution = {session_type: type, minute: end, lap_at_minute: fmt(curve.last.lap), lap_at_minute_s: r3(curve.last.lap), change_from_start_s: r3(curve.last.lap - curve.points[0].lap),
      curve: curve.points.map(p => ({minute: p.minute, lap_s: r3(p.lap)})),
      basis: f1Wet ? 'flat: measured wet gap to the dry lap (evolution shape rejected by Gate G)' : P.useCurve ? `measured ${type} curve at this track` : c.calibrated ? 'fitted series coefficients' : 'uncalibrated default coefficients',
      ...(se === 'wec' && args.tyre && args.tyre !== 'slick' ? {wet_note: 'WEC/LMGT3 wet pace: not measured (wetness formula with assumed tyre penalties)'} : {}),
      holdout_error_pct: c.holdoutPct, reference: 'the simulated lap = track state at the end of qualifying',
      assumptions: 'lap = reference × (1 + rubber(t) + wet(t) + warm-up(k)); rubber −a(1−e^(−t/τ)) or the measured curve, wet = wetness × tyre penalty × e^(−t/drying), warm-up fades over the given laps'};
  }
  if (args.compare_car && carKey(args.compare_car) !== selKey) {
    const c = cars[carKey(args.compare_car)], r2 = run(c);
    out.compare = {car: {series: c.series || 'f1', class: c.cls || null, year: c.year, kind: c.kind}, error_range_s: c.unc?.pct ? r3(r2.lapTime * c.unc.pct / 100) : null, ...summary(r2, d, c.car), delta_s: r3(res.lapTime - r2.lapTime), delta_note: 'result minus compare; positive = the first car is slower'};
  }
  const cal = sel.series ? lapsimCalibration?.series?.[sel.series]?.[sel.cls]?.[sel.year]?.tracks?.[id] : lapsimCalibration?.seasons?.[sel.year]?.tracks?.[id];
  if (cal && sel.kind === 'calibrated' && sel.series) {
    const same = !args.apply_fia_changes && ['air_temp_c', 'track_temp_c', 'humidity_pct', 'pressure_hpa', 'altitude_m', 'wind_speed_ms', 'wind_from_deg'].every(k => args[k] === undefined);
    out.real_lap = {year: sel.year, event: cal.event, lap_time: fmt(cal.realLap), car_number: cal.car ?? null, manufacturer: cal.manufacturer ?? null, speed_trap_kph: cal.trapKph ?? null,
      fit_error_s: r3(cal.errorSec), ...(same ? {simulated_minus_real_s: r3(res.lapTime - cal.realLap)} : {})};
  } else if (cal && sel.kind === 'calibrated') {
    const same = !args.apply_fia_changes && ['air_temp_c', 'track_temp_c', 'humidity_pct', 'pressure_hpa', 'altitude_m', 'wind_speed_ms', 'wind_from_deg'].every(k => args[k] === undefined);
    out.real_lap = {year: sel.year, position: cal.position ?? 1, lap_time: fmt(cal.realLap), driver_number: cal.driver ?? null, fit_error_s: r3(cal.errorSec), speed_rms_kph: cal.rmsKph,
      ...(same ? {simulated_minus_real_s: r3(res.lapTime - cal.realLap)} : {})};
  }
  const rr = raceRecords(id)[sel.series ? selKey : String(sel.year)];
  if (rr) out.real_race_lap = {lap_time: fmt(rr.lap), lap_seconds: rr.lap, year: rr.year, by: rr.who, event: rr.event, source: rr.source, note: 'fastest real race lap of this car on this track'};
  const proj = lapsimCalibration?.projections?.[sel.year];
  if (sel.kind === 'projected') out.projection = {rules: RULE_CHANGES[sel.year]?.note?.en, rules_effect_pct: proj?.rulesEffectPct ?? null,
    development_pct: proj?.developmentTargetPct ?? null, development_band_pct: proj?.bandPct ?? null};
  if (ch) out.fia_changes = {event: ch.event, year: ch.year, document: ch.document,
    items: ch.changes.map(c => ({text: c.text, type: c.type, affects_lap: c.affectsLap, assumed_effect: c.affectsLap ? c.effect?.en : null})),
    applied: applied.map(a => ({type: a.type, applied: a.applied, from_m: a.sStart != null ? Math.round(a.sStart) : null, to_m: a.sEnd != null ? Math.round(a.sEnd) : null})),
    note: fittedYear(id) >= ch.year ? `The cars were fitted on a real ${fittedYear(id)} lap that already ran with these changes; switching them on adds them a second time.` : 'Not yet in the fitted laps: switch them on to estimate their effect.'};
  out.assumptions = [...(given.length ? [`Given by you: ${given.join(', ')}; the real-lap correction of the unchanged car is kept, so the result is the real lap plus the simulated difference.`] : []), 'Engine power follows a torque curve and gear ratios (preset per rule set in powertrains.js unless given), capped at the regulation or BoP power.', 'Grip versus track temperature is an assumed curve (best near 35 °C).', 'Engine power changes with air density as (density/1.18)^0.15 (assumed for a turbocharged engine).',
    'FIA change effects are assumed sizes, not measurements.', 'No gear shifts, tyre temperature, fuel burn or car-to-car effects.', '2026-2028 energy: recovered under braking and, on throttle, from engine power the tyres cannot use; harvesting at full throttle at the end of straights ("super-clipping") is used only when it makes the lap faster; per-event qualifying recharge limit from 2026 press reports (FIA values per circuit), reused for 2027/2028.'];
  out.page = `${SITE}/simulation?track=${encodeURIComponent(id)}&car=${selKey}`;
  return out;
}

export async function lapsimCall(name, args) {
  if (name !== 'lapsim_simulate') throw Error('Unknown lap simulator tool');
  return {content: [{type: 'text', text: JSON.stringify(simulate(args))}], isError: false};
}
