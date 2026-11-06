// Air and wind for the lap simulator. Pure functions, shared by server and browser.

const RD = 287.058;   // J/(kg·K), dry air
const RV = 461.495;   // J/(kg·K), water vapour
export const RHO_REF = 1.18; // kg/m³, the density the TUM base car was set up with

// Saturation vapour pressure over water, hPa (Buck 1981).
export function saturationVapourPressure(tempC) {
  return 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
}

// Station pressure (hPa) from altitude (m) for the ISA atmosphere; used only when no measurement exists.
export function pressureFromAltitude(altitudeM) {
  return 1013.25 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
}

// Moist-air density in kg/m³ from station pressure (hPa), air temperature (°C) and relative humidity (%).
export function airDensity({ pressureHpa, tempC, humidityPct = 50 }) {
  if (!Number.isFinite(pressureHpa) || !Number.isFinite(tempC)) throw new TypeError('pressureHpa and tempC are required');
  const T = tempC + 273.15;
  const pv = Math.min(1, Math.max(0, humidityPct / 100)) * saturationVapourPressure(tempC);
  const pd = pressureHpa - pv;
  return (pd * 100) / (RD * T) + (pv * 100) / (RV * T);
}

// Wind along the track. headingRad: direction of travel in the east/north frame
// (0 = east, π/2 = north). windFromDeg: meteorological direction the wind comes FROM
// (0 = from north, 90 = from east). Returns the tailwind component in m/s (negative = headwind).
export function tailwind(headingRad, windSpeed, windFromDeg) {
  if (!windSpeed) return 0;
  const toRad = (windFromDeg + 180) * Math.PI / 180;     // direction the air moves TO, clockwise from north
  const we = windSpeed * Math.sin(toRad), wn = windSpeed * Math.cos(toRad);
  return we * Math.cos(headingRad) + wn * Math.sin(headingRad);
}

// Tyre grip factor from track temperature. Assumption, not a measured curve: grip peaks
// near tOpt and falls off quadratically (a per 10 °C squared). Calibrated values may replace it.
export function gripFromTrackTemp(trackTempC, { tOpt = 35, a = 0.005, floor = 0.9 } = {}) {
  if (!Number.isFinite(trackTempC)) return 1;
  const x = (trackTempC - tOpt) / 10;
  return Math.max(floor, 1 - a * x * x);
}

// ICE power factor from intake air. Turbocharged engines recover most of the density loss,
// so power follows density only weakly: (ρ/ρref)^beta. beta is a calibration value.
export function icePowerFactor(rho, { beta = 0.15, rhoRef = RHO_REF } = {}) {
  return Math.pow(rho / rhoRef, beta);
}

// One call that turns session weather into simulator conditions.
export function conditionsFromWeather(w = {}, opts = {}) {
  const pressureHpa = Number.isFinite(w.pressureHpa) ? w.pressureHpa
    : Number.isFinite(w.altitudeM) ? pressureFromAltitude(w.altitudeM) : 1013.25;
  const tempC = Number.isFinite(w.airTempC) ? w.airTempC : 25;
  const rho = airDensity({ pressureHpa, tempC, humidityPct: Number.isFinite(w.humidityPct) ? w.humidityPct : 50 });
  return {
    rho,
    windSpeed: Number.isFinite(w.windSpeed) ? w.windSpeed : 0,
    windFromDeg: Number.isFinite(w.windFromDeg) ? w.windFromDeg : 0,
    grip: gripFromTrackTemp(w.trackTempC, opts.grip),
    iceFactor: icePowerFactor(rho, opts.ice),
    inputs: { pressureHpa, tempC, humidityPct: w.humidityPct ?? 50, trackTempC: w.trackTempC ?? null },
  };
}
