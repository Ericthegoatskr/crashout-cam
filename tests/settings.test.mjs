import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { restoreSettings } from '../dist/settings.js';
import { Stabilizer } from '../dist/detection.js';
const defaults = JSON.parse(fs.readFileSync(new URL('../dist/config.json', import.meta.url)));

test('existing users lose the legacy wait without losing sensitivity preferences', () => {
  const config = restoreSettings(defaults, {}, { holdMs: 500, smileThreshold: .3, jawThreshold: .6 });
  assert.equal(config.holdMs, 0);
  assert.equal(config.smileThreshold, .3);
  assert.equal(config.jawThreshold, .6);
  const state = new Stabilizer(config);
  assert.equal(state.update('listen', 0), 'listen');
  assert.equal(state.update('overload', 33), 'overload');
  assert.equal(state.update('neutral', 66), 'neutral');
});
test('explicit new delay settings remain available', () => {
  const state = new Stabilizer(restoreSettings(defaults, { holdMs: 150 }));
  assert.equal(state.update('happy', 0), 'neutral');
  assert.equal(state.update('happy', 150), 'happy');
});
test('malformed stored settings cannot introduce an invalid delay', () => {
  assert.equal(restoreSettings(defaults, { holdMs: -1 }).holdMs, 0);
  assert.equal(restoreSettings(defaults, null, null).holdMs, 0);
});
