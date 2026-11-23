import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackLimitSections, parseTrackLimits, entryFrom, parseImsaBriefing, tracksFor, docLinks} from '../scripts/sim/track-limits.mjs';
import {lapsimTrackLimits} from '../worker/lapsim/track-limits-data.js';

const fixture = name => readFileSync(new URL(`./fixtures/track-limits/${name}.txt`, import.meta.url), 'utf8');
const turns = p => p.corners.map(c => `${c.turn}${c.letter || ''}:${c.rule}`);

test('2022 notes, "15) | Track Limits": general white-line rule, pit-exit line unparsed, next section excluded', () => {
  const s = trackLimitSections(fixture('2022-abu-dhabi'));
  assert.equal(s.length, 1);
  assert.doesNotMatch(s[0], /Fire extinguishers/);
  const p = parseTrackLimits(s);
  assert.deepEqual(turns(p), []);
  assert.equal(p.allCorners, true);
  assert.equal(p.generalRule, 'line');
  assert.equal(p.unparsed.length, 1);
  assert.match(p.unparsed[0], /pit exit/);
});

test('2025 notes, "16. | Track Limits": last-corner clause inherits the white line', () => {
  const p = parseTrackLimits(trackLimitSections(fixture('2025-austria')));
  assert.deepEqual(turns(p), ['10:line']);
  assert.equal(p.allCorners, true);
});

test('rejoin routes are "other", a cut behind the apex kerb is "kerb"; page markers do not end the section', () => {
  const s = trackLimitSections(fixture('2025-canada'));
  assert.doesNotMatch(s[0], /\[page|Pit Entry/);
  assert.deepEqual(turns(parseTrackLimits(s)), ['1:other', '9:kerb', '13:kerb']);
});

test('kerb, loop and "or" lists', () => {
  const p = parseTrackLimits(['5. Track Limits The track edge at the exit of Turn 4 is the outer edge of the kerb. A detection loop is installed at Turns 9 and 10. Each time a driver fails to negotiate turns 18 or and 19 the lap is deleted.']);
  assert.deepEqual(turns(p), ['4:kerb', '9:loop', '10:loop', '18:other', '19:other']);
});

test('IMSA briefing slides: slide titles name the corners, the bullet sets the rule', () => {
  const p = parseImsaBriefing('TRACK LIMITS – TURN 1\n|   16\nSHORT CUT – TURN 5\nTRACK LIMITS – TURN 10\nTRACK LIMITS\n• Two wheels must remain on racing surface, including painted curbing');
  assert.deepEqual(turns(p), ['1:kerb', '5:other', '10:kerb']);
  assert.equal(p.allCorners, true);
});

test('event names per season and quote-paired document links', () => {
  assert.deepEqual(tracksFor('Spanish Grand Prix', 2025), ['catalunya']);
  assert.deepEqual(tracksFor('Spanish Grand Prix', 2026), ['madring']);
  assert.deepEqual(tracksFor('Bahrain Grand Prix', 2026), ['kuala-lumpur']);
  const [d] = docLinks(`<li class="document-row"><a href="/x/2023 GP - Race Director's Event Notes.pdf"><div class="title">Doc 5</div></a></li>`, 'https://www.fia.com/');
  assert.match(d.url, /Race%20Director's%20Event%20Notes\.pdf$/);
  assert.equal(entryFrom({track: 'x', year: 2025}, []).status, 'no document');
});

test('stored catalogue has the agreed shape', () => {
  assert.ok(lapsimTrackLimits.length > 0);
  for (const r of lapsimTrackLimits) {
    assert.ok(['f1', 'imsa', 'wec'].includes(r.series), r.track);
    assert.ok(['parsed', 'unparsed', 'no document'].includes(r.status), r.track);
    assert.equal(typeof r.year, 'number');
    assert.ok(Array.isArray(r.corners) && Array.isArray(r.unparsed));
    for (const c of r.corners) {
      assert.ok(Number.isInteger(c.turn) && c.turn > 0, `${r.track} ${r.year}`);
      assert.ok(['line', 'kerb', 'loop', 'other'].includes(c.rule));
      assert.equal(typeof c.text, 'string');
    }
    if (r.status === 'parsed') assert.ok(r.doc?.url && (r.corners.length || r.allCorners));
    if (r.status === 'no document') assert.equal(r.corners.length, 0);
  }
});
