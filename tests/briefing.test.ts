import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanTitle, makeBriefing } from '../src/lib/briefing';

test('briefing reads only open tasks and preserves their species', () => {
  const text = makeBriefing([
    { species: 'Hazel', title: 'Check tree guards', done: false },
    { species: 'Walnut', title: 'Photograph leaves', done: true },
  ]);
  assert.match(text, /1 open task/);
  assert.match(text, /Hazel: Check tree guards/);
  assert.doesNotMatch(text, /Photograph leaves/);
});

test('task titles are normalized and bounded', () => {
  assert.equal(cleanTitle('  Check   guards  '), 'Check guards');
  assert.throws(() => cleanTitle(' '.repeat(10)));
  assert.throws(() => cleanTitle('x'.repeat(121)));
});
