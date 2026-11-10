// One dry-session scope for calibration and historical reproduction.
import {readFileSync} from 'node:fs';

const wet = JSON.parse(readFileSync(new URL('./data/wet-sessions.json', import.meta.url), 'utf8')).wec || {};

export function wecExclusion(row) {
  const manual = wet[`${row.year} ${row.track}`];
  if (manual) return {reason: 'wet-sessions.json', evidence: manual};
  if (row.weather?.rain) return {reason: 'rain-marked row'};
  return null;
}

export function splitWecSessions(rows) {
  const dry = [], excluded = [];
  for (const row of rows) {
    const exclusion = wecExclusion(row);
    if (exclusion) excluded.push({row, ...exclusion});
    else dry.push(row);
  }
  return {dry, excluded};
}
