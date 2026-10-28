import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMPLES,
  validateWorkInput,
  validateStatus,
  spokenTask,
  type WorkTask,
} from '../src/lib/work-order';
import { briefingAudioKey } from '../src/lib/briefing-audio';
import { liveVoiceEnabled } from '../src/lib/voice-policy';

const sample = EXAMPLES[0];
const input = { species: sample.species, english: sample.english, spanish: sample.spanish };
const task: WorkTask = {
  ...sample.english,
  id: '1',
  species: sample.species,
  spanish: sample.spanish,
  revision: 1,
  status: 'ready',
  done: false,
  helpNote: '',
};

test('publishing requires a location and completion criteria, without fabricating either', () => {
  assert.throws(
    () => validateWorkInput({ ...input, english: { ...input.english, location: '' } }),
    /location/,
  );
  assert.throws(
    () => validateWorkInput({ ...input, english: { ...input.english, doneWhen: '' } }),
    /finished/,
  );
  assert.deepEqual(validateWorkInput(input), input);
});
test('English-only publication is valid but incomplete Spanish cannot be published', () => {
  assert.equal(validateWorkInput({ ...input, spanish: null }).spanish, null);
  assert.throws(
    () => validateWorkInput({ ...input, spanish: { ...input.spanish, materialsLocation: '' } }),
    /Spanish/,
  );
  assert.throws(
    () => validateWorkInput({ ...input, spanish: { ...input.spanish, doneWhen: '' } }),
    /Spanish/,
  );
});
test('requesting help requires a bounded note and resolving work clears the active blocker', () => {
  assert.throws(() => validateStatus('blocked', '   '), /help/);
  assert.throws(() => validateStatus('blocked', 'a'.repeat(241)), /long/);
  assert.throws(() => validateStatus('invented'), /Invalid/);
  assert.deepEqual(validateStatus('blocked', '  Need ties  '), {
    status: 'blocked',
    helpNote: 'Need ties',
  });
  assert.deepEqual(validateStatus('done', 'old problem'), { status: 'done', helpNote: '' });
});
test('changed instructions and language cannot reuse stale audio; status-only changes can', () => {
  const key = (value: WorkTask, language: 'en' | 'es') =>
    briefingAudioKey('orchard', language + ':' + spokenTask(value, language), 'voice');
  assert.notEqual(key(task, 'en'), key(task, 'es'));
  assert.notEqual(key(task, 'en'), key({ ...task, materialsLocation: 'South shed' }, 'en'));
  assert.equal(key(task, 'en'), key({ ...task, status: 'doing', revision: 2 }, 'en'));
  assert.equal(spokenTask({ ...task, spanish: null }, 'es'), null);
});
test('preview cannot enable live credit spending via environment flags', () => {
  const previous = process.env.ELEVENLABS_CAPTURE_ENABLED;
  process.env.ELEVENLABS_CAPTURE_ENABLED = 'true';
  assert.equal(liveVoiceEnabled(), false);
  if (previous === undefined) delete process.env.ELEVENLABS_CAPTURE_ENABLED;
  else process.env.ELEVENLABS_CAPTURE_ENABLED = previous;
});
