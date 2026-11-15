import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPage} from '../worker/setup-page.js';
import {f1CarViews, f1CarViews2025} from '../worker/f1-car-views.js';

test('SetupSim shows the four 2026 F1 car views for F1 only (owner 2026-11-15)', () => {
  const f1 = setupPage({}, 'ko');
  for (const v of ['front', 'side', 'rear', 'top']) {
    assert.match(f1, new RegExp(`src="/assets/f1-2026/${v}\\.webp"`));
    const bin = Buffer.from(f1CarViews[v], 'base64');
    assert.equal(bin.subarray(0, 4).toString(), 'RIFF'); assert.equal(bin.subarray(8, 12).toString(), 'WEBP');
  }
  assert.doesNotMatch(setupPage({series: 'hypercar'}, 'en'), /f1-2026\//);
});

test('SetupSim lists F1 2025 as UI only: its car views and a coming-soon note, no car/circuit pickers yet', () => {
  const h = setupPage({series: 'f1-2025'}, 'ko');
  assert.match(h, /<option value="f1-2025" selected/);
  for (const v of ['front', 'side', 'rear', 'top']) {
    assert.match(h, new RegExp(`src="/assets/f1-2025/${v}\\.webp"`));
    assert.equal(Buffer.from(f1CarViews2025[v], 'base64').subarray(8, 12).toString(), 'WEBP');
  }
  assert.doesNotMatch(h, /name="(car|track)"/); assert.match(h, /준비 중/);
  assert.match(setupPage({}, 'en'), /<option value="f1-2025">F1 2025<\/option><option value="f1" selected>/);
});
