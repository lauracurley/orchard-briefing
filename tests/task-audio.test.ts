import test from 'node:test';
import assert from 'node:assert/strict';
import { taskAudioIdentity, serveTaskAudio } from '../src/lib/task-audio';
import { EXAMPLES, spokenTask, type WorkTask } from '../src/lib/work-order';
const example = EXAMPLES[0];
const task = { ...example.english, german: example.german, spanish: example.spanish } as WorkTask;
test('exact public examples share recordings, while custom text stays workspace-scoped', () => {
  const text = spokenTask(task, 'de')!;
  const first = taskAudioIdentity('first', text, 'de', 'voice');
  assert.equal(first.shared, true);
  assert.deepEqual(first, taskAudioIdentity('second', text, 'de', 'voice'));
  const custom = taskAudioIdentity('first', text + ' Extra instruction.', 'de', 'voice');
  assert.equal(custom.shared, false);
  assert.notEqual(
    custom.key,
    taskAudioIdentity('second', text + ' Extra instruction.', 'de', 'voice').key,
  );
  assert.notEqual(first.key, taskAudioIdentity('first', text, 'en', 'voice').key);
  assert.notEqual(first.key, taskAudioIdentity('first', text, 'de', 'other-voice').key);
});
test('invalid recording requests are rejected before accessing a database or provider', async () => {
  for (const body of [
    '{',
    'null',
    '{}',
    JSON.stringify({ text: 'Do not synthesize arbitrary request text' }),
    'x'.repeat(1001),
  ]) {
    for (const generate of [false, true]) {
      const response = await serveTaskAudio(
        new Request('http://localhost/api/task-audio', { method: 'POST', body }),
        generate,
      );
      assert.equal(response.status, 400);
    }
  }
});
