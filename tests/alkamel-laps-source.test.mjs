import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv, carRows, options, sessionKind, secs} from '../scripts/sim/learn/fetch-alkamel-laps.mjs';

// a few derived lines in the Al Kamel column layout (23_AnalysisEnduranceWithSections, 03_Results), not a stored raw file
const analysis = `NUMBER; DRIVER_NUMBER; LAP_NUMBER; LAP_TIME; CROSSING_FINISH_LINE_IN_PIT; S1; S2; S3; TOP_SPEED;DRIVER_NAME;CLASS;TEAM;MANUFACTURER;FLAG_AT_FL;S1_SECONDS;S2_SECONDS;S3_SECONDS
32;1;1;1:36.100;;;;;;A;Pro-Am;GMG;Porsche;GF;35.000;40.000;21.100
32;1;2;1:34.023;B;;;;;A;Pro-Am;GMG;Porsche;GF;34.000;39.500;20.523
32;1;3;1:34.500;;;;;222.2;A;Pro-Am;GMG;Porsche;GF;34.100;39.700;20.700
017;2;1;1:34.143;;;;;220.0;B;Pro-Am;Kellymoss;Porsche;FCY;34.2;39.4;20.543`;
const results = `POS;NUMBER;LAP;TIME;VEHICLE\n1;32;2;1:34.023;Porsche 911 GT3-R (992) EVO\n2;017;1;1:34.143;Porsche 911 GT3-R (992)`;
const race = `POSITION;NUMBER;LAPS;TOTAL_TIME;FL_TIME;VEHICLE\n1;32;109;3:00:51.624;1:34.023;Porsche`;

test('Al Kamel rows: best lap matches the classification; clean lap skips pit-lane and yellow laps', () => {
  const rows = carRows(parseCsv(analysis), parseCsv(results));
  const a = rows.find(r => r.car === '32'), b = rows.find(r => r.car === '017');
  assert.equal(a.best, a.officialBest);                  // 94.023 = official best (it crossed into the pit lane)
  assert.equal(a.clean.lap, 94.5); assert.deepEqual(a.clean.sectors, [34.1, 39.7, 20.7]); assert.equal(a.clean.topSpeedKph, 222.2);
  assert.equal(a.model, 'Porsche 911 GT3-R (992) EVO'); assert.equal(a.laps, 3);
  assert.equal(b.clean, null);                           // only lap under full-course yellow
  assert.equal(carRows(parseCsv(analysis), parseCsv(race)).find(r => r.car === '32').officialBest, 94.023); // race: FL_TIME, not total time
});

test('Al Kamel index: option values (capital Value=) and session kinds', () => {
  assert.deepEqual(options('<select name="evvent" onchange="x()"><option Value="01_Sonoma Raceway">S</option><option value=\'06_Road America\'>R</option></select>', 'evvent'), ['01_Sonoma Raceway', '06_Road America']);
  assert.deepEqual(['Qualify Driver 1', 'Race 1', 'Practice 2', 'SRO Test'].map(sessionKind), ['qualifying', 'race', 'practice', 'test']);
  assert.equal(secs('2:03.527'), 123.527); assert.equal(secs(''), null);
});

test('Al Kamel paths with and without a series level; endurance hour folders', async () => {
  const {sessionFile} = await import('../scripts/sim/learn/fetch-alkamel-laps.mjs');
  assert.deepEqual(sessionFile('/Results/06_SRO/26_2026/01_Sonoma%20Raceway/01_GT%20World%20Challenge%20America/202603281035_Race%201/23_AnalysisEnduranceWithSections_Race%201.CSV'),
    {champ: '01_GT World Challenge America', session: '202603281035_Race 1', hour: 0, file: '23_AnalysisEnduranceWithSections_Race 1.CSV'});
  assert.deepEqual(sessionFile('/Results/21_2026/04_SPA%20FRANCORCHAMPS/668_European%20Le%20Mans%20Series/202608231300_Race/Hour%204/23_Analysis_Race.CSV'),
    {champ: '668_European Le Mans Series', session: '202608231300_Race', hour: 4, file: '23_Analysis_Race.CSV'});
  assert.equal(sessionFile('/Results/21_2026/x/file.CSV'), null);
});

test('Al Kamel: deleted laps (quicker, not marked as improvement) are skipped; race times with an apostrophe', () => {
  const a = `NUMBER;LAP_NUMBER;LAP_TIME;LAP_IMPROVEMENT;CROSSING_FINISH_LINE_IN_PIT;FLAG_AT_FL\n31;1;2:20.000;1;;GF\n31;2;2:14.280;0;;GF\n31;3;2:15.245;1;;GF\n31;4;2:16.000;0;;GF`;
  const r = carRows(parseCsv(a), parseCsv(`NUMBER;FL_TIME\n31;2'15.245`))[0];
  assert.equal(r.best, 135.245); assert.equal(r.officialBest, 135.245); assert.equal(r.clean.lap, 135.245); assert.equal(r.laps, 4);
  assert.equal(secs("2'03.875"), 123.875);
});
