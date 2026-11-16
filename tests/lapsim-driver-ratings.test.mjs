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
      assert.ok(['event', 'season', 'unknown'].includes(x.how));
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

test('printed values: only the four FIA names map to a rating', () => {
  assert.equal(ratingOf('Platinum'), 'P'); assert.equal(ratingOf('Platinium'), 'P'); assert.equal(ratingOf('g'), 'G'); assert.equal(ratingOf('Bronze FIA'), 'B');
  for (const v of ['', 'S*', 'S-B', 'S*-B IN NA', 'Pro', null]) assert.equal(ratingOf(v), null);
  assert.equal(lineupString(['B', 'P', 'G']), 'PGB'); assert.equal(lineupString(['B', null]), null);
});
