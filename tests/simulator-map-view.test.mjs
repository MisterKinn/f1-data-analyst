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
