import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {csvRows, typedLaps, fileStats, sessions, readSession, coverageMarkdown, weatherSeries} from '../scripts/sim/learn/alkamel-full-laps.mjs';
import {pickFiles, disallowed} from '../scripts/sim/learn/fetch-alkamel-full-laps.mjs';

// invented values in the Al Kamel column layouts (WEC Analysis with leading-space headers and a trailing ";", IMSA Time Cards in °F)
const fx = n => readFileSync(new URL(`fixtures/alkamel-full/${n}`, import.meta.url), 'utf8');

test('WEC Analysis: typed laps, pit in/out, stints, sectors, weather by elapsed time', () => {
  const laps = typedLaps(csvRows(fx('wec-race-analysis.csv')), csvRows(fx('wec-race-weather.csv')));
  assert.equal(laps.length, 7);
  const c7 = laps.filter(l => l.car === '7');
  assert.deepEqual(c7.map(l => [l.lap, l.stint, l.stintLap, l.pitIn, l.pitOut]), [[1, 1, 1, false, true], [2, 1, 2, false, false], [3, 1, 3, true, false], [4, 2, 1, false, true], [5, 2, 2, false, false]]);
  assert.equal(c7[1].time, 211.5); assert.deepEqual(c7[1].sectors, [33.5, 87, 91]); assert.equal(c7[1].topSpeedKph, 335);
  assert.equal(c7[3].pitTime, 55.3); assert.equal(c7[3].driver, 'Test DRIVER B'); assert.equal(c7[3].driverNumber, 2); assert.equal(c7[4].flag, 'FCY');
  assert.equal(c7[0].cls, 'HYPERCAR'); assert.equal(c7[0].tyre, null);
  assert.equal(c7[0].airTempC, 24.3); assert.equal(c7[0].trackTempC, 38.6); // elapsed 220 s -> weather row at 300 s
  assert.equal(c7[4].rain, true);                       // 1129.6 s -> row at 900 s
});

test('IMSA Time Cards: tyre column kept; °F weather converted to °C', () => {
  const laps = typedLaps(csvRows(fx('imsa-timecards.csv')), csvRows(fx('imsa-weather.csv')));
  assert.equal(laps.length, 3); assert.equal(laps[1].tyre, 'M'); assert.equal(laps[0].airTempC, 20); assert.equal(laps[2].airTempC, 21);
  assert.equal(weatherSeries(csvRows(fx('wec-race-weather.csv')))[0].airTempC, 24.1); // hPa file stays in °C
});

test('manifest stats, stored sessions and the coverage table', () => {
  const rows = csvRows(fx('wec-race-analysis.csv')), st = fileStats(rows);
  assert.equal(st.rows, 7); assert.equal(st.cars, 2); assert.deepEqual(st.lapsPerCar, {min: 2, median: 5, max: 5}); assert.deepEqual(st.classes, {HYPERCAR: 1, LMGT3: 1});
  assert.ok(st.columns.includes('DRIVER_NUMBER') && st.columns.includes('S3_SECONDS'));
  const dir = mkdtempSync(join(tmpdir(), 'alk-')), put = (p, n) => { mkdirSync(dirname(join(dir, p)), {recursive: true}); writeFileSync(join(dir, p), gzipSync(fx(n))); };
  put('wec/2025/LE MANS/race/analysis.csv.gz', 'wec-race-analysis.csv'); put('wec/2025/LE MANS/race/weather.csv.gz', 'wec-race-weather.csv');
  const base = {series: 'wec', season: 2025, event: 'LE MANS', session: 'Race', kind: 'race'};
  const manifest = {files: [{...base, file: 'analysis', path: 'wec/2025/LE MANS/race/analysis.csv.gz', ...st}, {...base, file: 'weather', path: 'wec/2025/LE MANS/race/weather.csv.gz'}]};
  const [s] = sessions(manifest); assert.equal(readSession(s, dir).length, 7);
  assert.match(coverageMarkdown(manifest), /\| 2025 \| wec \| LE MANS \| HYPERCAR \| 1 \| 1 \| 7 \| yes \|/);
});

test('file choice: last hour of a race, the lap file and the weather file only; robots rules', () => {
  const u = p => 'https://files.alkamelcloud.com/wec/results/14_2025/04_LE%20MANS/580_FIA%20WEC/202506141600_Race/' + p;
  const picked = pickFiles(['09_Hour%209/Analysis_Race_Hour%209.CSV', '24_Hour%2024/Analysis_Race_Hour%2024.CSV', '24_Hour%2024/Weather_Race_Hour%2024.CSV',
    '24_Hour%2024/Classification_Race_Hour%2024.CSV', '24_Hour%2024/Analysis_Race_Hour%2024.PDF'].map(p => ({series: 'wec', season: 2025, event: 'LE MANS', url: u(p)})));
  assert.deepEqual(picked.map(f => [f.file, f.hour, f.session]).sort(), [['analysis', 24, 'Race'], ['weather', 24, 'Race']]);
  assert.equal(disallowed('User-agent: *\nDisallow: /private', '/private/x.csv'), true);
  assert.equal(disallowed('User-agent: other\nDisallow: /', '/wec/results/a.csv'), false);
  assert.equal(disallowed('', '/a'), false);
});
