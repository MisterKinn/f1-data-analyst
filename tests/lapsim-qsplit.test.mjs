import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimQsplit} from '../worker/lapsim/qsplit-data.js';
import worker from '../worker/index.js';

const page = async q => (await worker.fetch(new Request('https://example.com/simulation?' + q), {})).text();

test('qualifying split: three ordered windows, Q3 best is the quickest, held-out error beats evolution alone', () => {
  for (const ys of Object.values(lapsimQsplit.tracks)) for (const r of Object.values(ys)) {
    assert.equal(r.seg.length, 3);
    assert.ok(r.seg[0][1] <= r.seg[1][0] && r.seg[1][1] <= r.seg[2][0]);
  }
  const T = lapsimQsplit.test;
  assert.ok(T.events >= 30 && T.q1RmsPct <= T.q1EvoOnlyPct && T.q2RmsPct <= T.q2EvoOnlyPct);
});

test('evolution panel lists Q1/Q2/Q3 with the real segment bests; Météo-France forecast is a condition option', async () => {
  const h = await page('track=monza&car=2026');
  assert.match(h, /data-ls="qsplit"><div class="output"><table/);
  assert.match(h, /<option value="forecast">예보 \(Météo-France\)<\/option>/);
  assert.match(h, /data-ll="45\.6156,9\.2811"/);
  assert.doesNotMatch(await page('track=monza&car=wec-lmh'), /data-ls="qsplit"><div/, 'F1 only');
});

test('forecast track temperature uses the fit on real session weather (better than the old assumption)', async () => {
  const {lapsimTrackTemp: T} = await import('../worker/lapsim/tracktemp-data.js');
  assert.ok(T && T.k > 0 && T.test.events >= 30 && T.test.rmsC < T.test.oldAssumptionRmsC);
  assert.match(await page('track=monza&car=2026'), /실제 세션 기상\(\d+개 대회\)에 맞춘 값/);
});
