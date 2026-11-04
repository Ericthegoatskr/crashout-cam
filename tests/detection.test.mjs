import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { classify, Stabilizer } from '../dist/detection.js';
const config = JSON.parse(fs.readFileSync(new URL('../dist/config.json', import.meta.url)));
const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url)));
for (const c of cases.classification) test(c.name, () => {
  const point = (x, y) => ({ x: .5 + (x - .5) * (c.scale ?? 1), y: .5 + (y - .5) * (c.scale ?? 1) });
  const face = Array.from({ length: 478 }, () => point(.5, .5));
  face[234] = point(.35, .4); face[454] = point(.65, .4);
  if (c.mirrorFace) [face[234], face[454]] = [face[454], face[234]];
  const hands = (c.hands ?? []).map(([x, y]) => Array.from({ length: 21 }, () => point(x, y)));
  assert.equal(classify(c.missing ? null : face, hands, c.scores ?? {}, config, c.aspect ?? 4 / 3, c.previous ?? 'neutral'), c.expected);
});
for (const c of cases.temporal) test(c.name, () => {
  const state = new Stabilizer({ ...config, holdMs: c.holdMs ?? 300 });
  for (const [raw, time, expected] of c.sequence) assert.equal(state.update(raw, time), expected, `at ${time}ms`);
});
test('all five original assets and model hashes are intact', () => {
  for (const state of config.states) assert.ok(fs.statSync(new URL(`../dist/${state.image}`, import.meta.url)).size > 0);
  const models = JSON.parse(fs.readFileSync(new URL('../models-manifest.json', import.meta.url)));
  for (const model of models) assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../dist/models/${model.file}`, import.meta.url))).digest('hex'), model.sha256);
});
