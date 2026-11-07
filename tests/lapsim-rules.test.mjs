import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extract, normalize} from '../scripts/sim/rule-params.mjs';

const spec = JSON.parse(readFileSync('knowledge/sim-rule-params.json', 'utf8'));
const target = car => spec.targets.find(t => t.car === car);
const val = (pages, car, key) => extract(pages, target(car).params.find(p => p.key === key), {section: target(car).section});

// Text as the PDF reader returns it (2027 Section C Issue 04, marked up: old value, then new value)
const c71 = normalize(`C5. 2 .3 Fuel energy flow must not exceed 3000MJ/h 3150MJ/h , with a maximum energy flow per cylinder
never exceeding 550MJ/h under normal operating conditions . C5. 2 .7 The absolute electrical DC power of the ERS - K may not exceed 350kW 375 kW .
ii. 300kW during any power limited period in Qualifying or Sprint Qualifying sessions, and when`);
const c72 = normalize(`C5. 2 .9 The difference between the maximum and the minimum state of charge of the ES may not exceed
4MJ 4.5MJ at any time the car is on the track. C5. 2 .10 Recharge , as measured at the CU - K HV DC Bus , must not exceed :
a. A limit of 8.5MJ in each lap, subject to the following additional conditions:`);
const c277 = normalize(`Changes Approved for 2028 C5.2 Power Unit Energy Flow / …/ C5.2.3 Fuel energy flow must not exceed 3150 3400 MJ/h.
C5.2.7 The absolute electrical DC power of the ERS - K may not exceed 375 400 kW. / …/ C5.2.9 The difference between the maximum and the minimum state of charge of the ES may not exceed
4.5 / 5.0 MJ at any time the car is on the track.`);
const f1 = [{page: 71, text: c71}, {page: 72, text: c72}, {page: 277, text: c277}];

test('2027 values: new value of a marked-up issue', () => {
  assert.equal(val(f1, 'f1-2027', 'fuelFlowMJh').value, 3150);
  assert.equal(val(f1, 'f1-2027', 'fuelFlowMJh').previousIssueValue, 3000);
  assert.equal(val(f1, 'f1-2027', 'ersAbsKW').value, 375);
  assert.equal(val(f1, 'f1-2027', 'qualiDeployKW').value, 300);
  assert.equal(val(f1, 'f1-2027', 'socMJ').value, 4.5);
  assert.equal(val(f1, 'f1-2027', 'rechargeMJ').value, 8.5);
});

test('2028 values come only from the approved-changes appendix', () => {
  assert.equal(val(f1, 'f1-2028', 'fuelFlowMJh').value, 3400);
  assert.equal(val(f1, 'f1-2028', 'ersAbsKW').value, 400);
  assert.equal(val(f1, 'f1-2028', 'socMJ').value, 5);
  assert.match(val([{page: 1, text: c71}], 'f1-2028', 'ersAbsKW').error, /section/);
});

test('Formula E Gen4 values from the English column', () => {
  const fe = [{page: 22, text: normalize('7.5 RESS power and energy limitations The maximum power flow from the RESS is 600 kW, of which no more than 350 kW can be supplied via the rear powertrain, and no more than 250 kW can be supplied via the front powertrain.')},
    {page: 23, text: normalize('The maximum power flow to the RESS is 700 kW, of which no more than 350kW can be supplied via the rear powertrain')},
    {page: 20, text: normalize('The mass of the car, including the driver, must not be less than 1046 kg at all times.')}];
  assert.equal(val(fe, 'fe-gen4', 'dischargeKW').value, 600);
  assert.equal(val(fe, 'fe-gen4', 'rearDischargeKW').value, 350);
  assert.equal(val(fe, 'fe-gen4', 'frontDischargeKW').value, 250);
  assert.equal(val(fe, 'fe-gen4', 'regenKW').value, 700);
  assert.equal(val(fe, 'fe-gen4', 'minMassKg').value, 1046);
});

test('a value outside its range is not applied', () => {
  const bad = [{page: 1, text: normalize('C5.2.3 Fuel energy flow must not exceed 9999MJ/h')}];
  assert.match(val(bad, 'f1-2027', 'fuelFlowMJh').error, /outside/);
});

test('FIA Power Unit Information: recharge limits by session from column positions', async () => {
  const {parsePuInfo} = await import('../worker/lapsim/pu-info.js');
  const row = (y, cells) => ({y, cells: cells.map(([text, x]) => ({text, x}))});
  // São Paulo 2026, Doc 3 page 2 (cell positions as read from the PDF)
  const rows = [row(445.6, [['Maximum Recharge per lap', 182.8], ['Maximum PU Power Reduction Rate', 424.3]]),
    row(434.6, [['Race', 108], ['Free Practice', 277.4], ['Out laps other than in', 337.3], ['Power Limited', 421.4]]),
    row(429.2, [['Qualifying', 209.4], ['Rate Limit', 500.9]]),
    row(423.4, [['Overtake not', 49.4], ['active', 90.7], ['Overtake active', 128.2], ['sessions', 284.3], ['Race', 362.9], ['Distance', 429.7]]),
    row(405.2, [['8.0 MJ', 67.7], ['8.5 MJ', 140.5], ['6.5 MJ', 213.4], ['8.5 MJ', 286.2], ['9.0 MJ', 359.1], ['2278 m', 430], ['100 kW/s', 498.6]])];
  assert.deepEqual(parsePuInfo([{page: 2, rows}]), {raceMJ: 8, raceOvertakeMJ: 8.5, qualiMJ: 6.5, practiceMJ: 8.5, outLapMJ: 9});
  assert.equal(parsePuInfo([{page: 1, rows: [row(1, [['Power Unit Information', 1]])]}]), null);
});
