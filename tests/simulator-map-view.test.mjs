import test from 'node:test';
import assert from 'node:assert/strict';
import {landscapeRot, VIEW, autoCorners} from '../worker/simulation.js';
import {lapsimAllTracks as T} from '../worker/lapsim/tracks.js';
import {lapsimTrackNorth as N} from '../worker/lapsim/track-north-data.js';

const aspect = (m, deg) => { const r = deg * Math.PI / 180; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; m.x.forEach((x, i) => { const X = x * Math.cos(r) - m.y[i] * Math.sin(r), Y = x * Math.sin(r) + m.y[i] * Math.cos(r); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }); return (x1 - x0) / (y1 - y0); };

test('maps open wide: Fuji, Monza, Jeddah, Bathurst and Mugello are wider than tall', () => {
  for (const id of ['fuji', 'monza', 'jeddah', 'bathurst', 'mugello']) assert.ok(aspect(T[id].map, landscapeRot(T[id].map, N[id], VIEW[id], T[id].corners, T[id].length)) > 1.3, id);
});

test('true north is known for every F1 and OpenStreetMap track; checked fits are within 25 m', () => {
  for (const id of ['monza', 'fuji', 'le-mans', 'daytona', 'sebring', 'bathurst', 'hockenheim', 'istanbul']) assert.ok(N[id] && N[id].rms < 25, id);
});

test('every track gets corner numbers (official or estimated from the curvature)', () => {
  for (const [id, t] of Object.entries(T)) if (t.kappa?.length && id !== 'rwanda') assert.ok((t.corners?.length || autoCorners(t).length) > 3, id);
});

test('DRS zones and Straight Mode zones never mix (owner 2026-11-15)', async () => {
  const m = await import('../worker/lapsim/f1-zones-data.js');
  const {tracks} = Object.values(m).find(v => v && v.tracks);
  for (const [id, years] of Object.entries(tracks)) for (const [slot, z] of Object.entries(years)) {
    const sm = Number(slot) >= 2026;
    assert.equal(z.kind, sm ? 'sm' : 'drs', `${id} ${slot}`);
    assert.ok(sm ? z.year >= 2026 : z.year < 2026, `${id} ${slot} source year ${z.year}`);
    for (const k of z.marks || []) assert.match(k.label, sm ? /^OT [DA]$/ : /^D\d$/, `${id} ${slot} mark ${k.label}`);
  }
});

test('Sakhir 2026 zones come from the Bahrain pre-season test map, not the Sepang-held Bahrain GP', async () => {
  const m = await import('../worker/lapsim/f1-zones-data.js');
  const {tracks} = Object.values(m).find(v => v && v.tracks);
  const z = tracks.sakhir['2026'];
  assert.equal(z.kind, 'sm'); assert.match(z.doc, /pre-season test/); assert.equal(z.zones.length, 4);
  assert.deepEqual(z.marks.map(k => k.label), ['OT D', 'OT A']);
  assert.equal(tracks.sakhir['2025'].kind, 'drs');
});

test('Bahrain Outer opens with its long straight flat along the bottom (owner 2026-11-15)', () => {
  assert.deepEqual(VIEW['sakhir-outer'], {longest: 'bottom'});
});

test('map labels (owner 2026-11-17): numbers smaller than before, names sized near them, one label per named complex, page language', async () => {
  const {simulationPage} = await import('../worker/simulation.js'), {CORNER_NAMES} = await import('../worker/simulator-ui.js');
  const map = (q, lang) => simulationPage(q, lang).match(/<svg class="ls-map"[\s\S]*?<\/svg>/)[0];
  const lm = map({track: 'le-mans'}, 'en');
  assert.deepEqual([...lm.matchAll(/class="ls-corner">([^<]+)</g)].slice(0, 3).map(m => m[1]), ['1', '2', '3'], 'numbered corners show their number');
  const fs = k => +lm.match(new RegExp('\\.' + k + '\\{font-size:([\\d.]+)px'))[1];
  assert.ok(fs('ls-corner\\.ls-corner-nm') > fs('ls-corner') * 0.6 && fs('ls-corner\\.ls-corner-nm') < fs('ls-corner'));
  // Le Mans names in both languages, each complex once; the first / second chicanes are Daytona and Michelin
  const le = CORNER_NAMES['le-mans'], en = le.map(e => e.en);
  assert.equal(new Set(en).size, en.length);
  for (const n of ['Dunlop Curve', 'Dunlop Chicane', 'Daytona Chicane', 'Michelin Chicane', 'Porsche Curves', 'Ford Chicane']) assert.ok(en.includes(n), n);
  assert.ok(!en.some(n => /^(Turn|The|First|Second|Corvette)\b/.test(n)));
  assert.ok(le.every(e => e.ko && !/[A-Za-z]{3}/.test(e.ko)), 'Korean names in Korean');
  // OpenStreetMap names (estimated corners): Korean page in Korean, English page as written, whole names
  assert.match(map({track: 'zolder'}, 'ko'), /class="ls-corner ls-corner-nm"[^>]*>에어스터 링크서</);
  assert.match(map({track: 'zolder'}, 'en'), /class="ls-corner ls-corner-nm"[^>]*>Eerste linkse</);
  // named straights, in the page language
  assert.match(map({track: 'silverstone'}, 'ko'), /ls-straight"[^>]*>행어 스트레이트</);
  assert.match(map({track: 'interlagos'}, 'en'), /ls-straight"[^>]*>Reta Oposta</);
  // Las Vegas landmarks (owner 2026-11-21), in lap order on the map
  const lv = map({track: 'las-vegas'}, 'ko');
  for (const n of ['스피어', '베네치안', '팔라조', '트레저 아일랜드', '미라지', '시저스 팰리스', '하이 롤러', '플라밍고', '벨라지오', '패리스', '플래닛 할리우드']) assert.match(lv, new RegExp('ls-straight"[^>]*>' + n + '<'), n);
  assert.match(map({track: 'las-vegas'}, 'en'), /ls-straight"[^>]*>Caesars Palace</);
});

test('Silverstone (owner 2026-11-17): non-F1 series number from Copse and start on the National Straight; Formula E keeps the F1 set-up', async () => {
  const {simulationPage} = await import('../worker/simulation.js');
  const map = q => simulationPage(q, 'en').match(/<svg class="ls-map"[\s\S]*?<\/svg>/)[0];
  const nums = svg => [...svg.matchAll(/class="ls-corner"( data-orig="(\d+)")?>(\d+)</g)].map(m => [m[3], m[2] || m[3]]);
  const wec = nums(map({track: 'silverstone', car: 'wec-lmh'})), f1 = nums(map({track: 'silverstone'})), fe = nums(map({track: 'silverstone', car: 'fe-gen4'}));
  assert.deepEqual(wec.find(([, o]) => o === '9'), ['1', '9'], 'Copse is T1');
  assert.deepEqual(wec.find(([, o]) => o === '8'), ['18', '8'], 'Woodcote is the last turn');
  assert.ok(f1.every(([a, b]) => a === b) && fe.every(([a, b]) => a === b), 'F1 and Formula E keep the official numbers');
});

test('Safety Car lines (owner 2026-11-17): yellow, track width, a tiny label, drawn under the racing line', async () => {
  const {simulationPage} = await import('../worker/simulation.js');
  const svg = simulationPage({track: 'monza'}, 'en').match(/<svg class="ls-map"[\s\S]*?<\/svg>/)[0];
  assert.equal((svg.match(/<line class="ls-sc"/g) || []).length, 2);
  assert.ok(svg.indexOf('class="ls-sc"') < svg.indexOf('class="ls-line-seg"'), 'under the racing line');
  assert.match(svg, /class="ls-sc-t"[^>]*>SC1</);
  assert.ok(!/ls-zone-mt-sc/.test(svg));
});
