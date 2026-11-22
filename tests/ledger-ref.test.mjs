import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerCheck} from '../scripts/ci/ledger-ref.mjs';

test('ledger check: model PRs need a marker, others pass', () => {
  assert.equal(ledgerCheck({files: ['docs/x.md']}).ok, true);
  assert.equal(ledgerCheck({files: ['worker/lapsim/channels.js'], body: 'changes the throttle'}).ok, false);
  assert.equal(ledgerCheck({files: ['worker/lapsim/channels.js'], body: 'x\nLedger: docs/gate-ledger.md 2026-11-22 F1 throttle'}).ok, true);
  assert.equal(ledgerCheck({files: ['scripts/sim/calibrate.mjs'], body: '- Data fix: FIA PU document Doc 3'}).ok, true);
  assert.equal(ledgerCheck({files: ['scripts/sim/gate.mjs'], body: 'No model change: test helper only'}).ok, true);
  assert.equal(ledgerCheck({files: ['worker/lapsim/x-data.js'], author: 'github-actions[bot]'}).ok, true);
  assert.equal(ledgerCheck({files: ['worker/lapsim/x-data.js'], branch: 'lapsim-learn/zones-refresh-1'}).ok, true);
  assert.equal(ledgerCheck({files: ['worker/lapsim/x.js'], body: 'Ledger:'}).ok, false);
});
