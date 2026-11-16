// Driver ratings data (task P1): official FIA categorisation per driver and season, line-up rating per car and event.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDriverRatings, coverage, bySeries, ratingAt, lineupOf, RATINGS} from '../scripts/sim/learn/driver-ratings.mjs';
import {ratingOf, lineupString} from '../scripts/sim/learn/build-driver-ratings.mjs';

const d = loadDriverRatings();

test('coverage report runs and counts every learned GT3 / LMP2 row', () => {
  const c = coverage(d), s = bySeries(c);
  assert.ok(c.length > 0 && s.length > 0);
  assert.equal(c.reduce((a, r) => a + r.rows, 0), d.learned.length);
  for (const r of c) { assert.ok(['gt3', 'lmp2'].includes(r.group)); assert.ok(r.lineup <= r.rows && r.bestLapDriver <= r.rows); }
  // the Al Kamel series are covered (official results CSVs print the category of every driver)
  for (const r of s.filter(r => ['wec', 'elms', 'alms', 'imsa'].includes(r.series))) assert.ok(r.lineup / r.rows > 0.9, `${r.group} ${r.series} ${r.lineup}/${r.rows}`);
});

test('every rating is P/G/S/B and has a source and a date', () => {
  for (const [id, p] of Object.entries(d.drivers)) for (const [season, s] of Object.entries(p.seasons)) for (const v of [s, ...(s.changes || [])]) {
    assert.ok(RATINGS.includes(v.rating), `${id} ${season} ${v.rating}`);
    assert.ok(v.source && v.source.length > 10, `${id} ${season} has no source`);
    assert.match(v.date, /^\d{4}-\d\d-\d\d$/);
  }
});

test('line-ups: ratings known or unknown, never guessed', () => {
  for (const [ev, cars] of Object.entries(d.lineups)) for (const [car, c] of Object.entries(cars)) {
    for (const x of c.drivers) {
      assert.ok(x.rating === null || RATINGS.includes(x.rating), `${ev} ${car}`);
      assert.ok(['event', 'season', 'fia-list', 'unknown'].includes(x.how));
      if (x.how === 'unknown') assert.equal(x.rating, null);
      if (x.how === 'season') assert.equal(x.rating, ratingAt(x.id, ev.split('|')[1], null, d) ?? x.rating);
      if (x.file != null) assert.ok(d.files[x.file], `${ev} ${car} file index`);
    }
    assert.equal(c.lineup, lineupString(c.drivers.map(x => x.rating)), `${ev} ${car}`);
    if (c.lineup) assert.match(c.lineup, /^P*G*S*B*$/);
  }
  for (const r of d.learned) {
    if (r.lineup) assert.equal(r.lineup, lineupOf(r.series, r.season, r.event, r.entry, d).lineup);
    if (r.bestLapDriver) { assert.ok(d.files[r.bestLapDriver.file]); assert.ok(lineupOf(r.series, r.season, r.event, r.entry, d).drivers.some(x => x.id === r.bestLapDriver.id), `${r.event} ${r.entry}`); }
  }
});

test('SRO entry-list text: category printed beside each driver, "-" stays unknown, car number from the # column', async () => {
  const {parseEntryText} = await import('../scripts/sim/learn/sro-entry-parse.mjs');
  const t = ['Car #       Competitor                Sponsor Name        Nationality Driver 1           Nationality categorisation   Driver 2           Nationality categorisa',
    '          2 Melbourne Performance     KFC Team MPC        AUS         Brad Schumacher    AUS         Bronze           Markus Winkelhock  DEU         Platinum',
    '         25 Method Motorsport         Method Motorsport   AUS         Marcos Flack       AUS         -                Chaz Mostert       AUS         Platinum',
    'QT  #    TEAM                   NAT  CAR                   DRIVER 1          LIC CAT  DRIVER 2            LIC CAT  CATEGORY',
    '53  177  Grupo Prom Racing Team GER  Mercedes-AMG GT3 EVO  Alfredo HERNANDEZ MEX B    Stephane TRIBAUDINI FRA B    BRONZE'].join('\n');
  const cars = parseEntryText(t);
  assert.deepEqual(cars.map(c => [c.car, c.drivers.map(x => x.cat).join('')]), [['2', 'BP'], ['25', 'P'], ['177', 'BB']]);
  assert.equal(cars[1].drivers[0].cat, null);
  // one CATEGORY column after the drivers is the car's cup (2026 GTWC Europe drafts): names only, never a driver rating
  const cup = parseEntryText(['QT  #   TEAM                 NAT  CAR                              DRIVER 1          LIC  DRIVER 2          LIC  DRIVER 3         LIC  CATEGORY',
    '9   11  Comtoyou Racing      BEL  Aston Martin Vantage AMR GT3 EVO Marcelo TOMASONI  BRA  Aaron MUSS        USA  Kyle MARCELLI    CAN  BRONZE'].join('\n'));
  assert.deepEqual(cup, [{car: '11', names: ['Marcelo TOMASONI', 'Aaron MUSS', 'Kyle MARCELLI']}]);
});

test('printed values: only the four FIA names map to a rating', () => {
  assert.equal(ratingOf('Platinum'), 'P'); assert.equal(ratingOf('Platinium'), 'P'); assert.equal(ratingOf('g'), 'G'); assert.equal(ratingOf('Bronze FIA'), 'B');
  for (const v of ['', 'S*', 'S-B', 'S*-B IN NA', 'Pro', null]) assert.equal(ratingOf(v), null);
  assert.equal(lineupString(['B', 'P', 'G']), 'PGB'); assert.equal(lineupString(['B', null]), null);
});
