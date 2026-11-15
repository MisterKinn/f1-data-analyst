import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPage} from '../worker/setup-page.js';
import {f1CarViews} from '../worker/f1-car-views.js';

test('SetupSim shows the four 2026 F1 car views for F1 only (owner 2026-11-15)', () => {
  const f1 = setupPage({}, 'ko');
  for (const v of ['front', 'side', 'rear', 'top']) {
    assert.match(f1, new RegExp(`src="/assets/f1-2026/${v}\\.webp"`));
    const bin = Buffer.from(f1CarViews[v], 'base64');
    assert.equal(bin.subarray(0, 4).toString(), 'RIFF'); assert.equal(bin.subarray(8, 12).toString(), 'WEBP');
  }
  assert.doesNotMatch(setupPage({series: 'hypercar'}, 'en'), /f1-2026\//);
});
