import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioBatch, type BatchAudioStore, type RecordingSpec } from '../src/lib/audio-batch';
import { AudioPendingError, AudioQuotaError } from '../src/lib/briefing-audio';

const recordings: RecordingSpec[] = [
  { key: 'en', language: 'en', text: 'Check guards', shared: false },
  { key: 'es', language: 'es', text: 'Revisar protectores', shared: false },
  { key: 'de', language: 'de', text: 'Schutzhüllen prüfen', shared: false },
];
function fixture(allowed = true) {
  const cache = new Map<string, string>();
  const owners = new Map<string, string>();
  const reservations: [number, number][] = [];
  const calls: string[] = [];
  const store: BatchAudioStore = {
    async load(key) {
      return cache.get(key) ?? null;
    },
    async claim(recording, owner) {
      if (owners.has(recording.key) || cache.has(recording.key)) return false;
      owners.set(recording.key, owner);
      return true;
    },
    async save(key, owner, value) {
      assert.equal(owners.get(key), owner);
      cache.set(key, value);
    },
    async release(key, owner) {
      if (owners.get(key) === owner) owners.delete(key);
    },
    async reserve(count, characters) {
      reservations.push([count, characters]);
      return allowed;
    },
  };
  const synthesize = async (recording: RecordingSpec) => {
    assert.ok(reservations.length, 'Reserve before spending credits');
    calls.push(recording.language);
    return Buffer.from(recording.text);
  };
  return { cache, owners, reservations, calls, store, synthesize };
}
test('one action creates every language and replay reserves nothing', async () => {
  const f = fixture();
  const audio = await createAudioBatch(recordings, f.store, f.synthesize, 'first');
  assert.deepEqual([...audio.keys()].sort(), ['de', 'en', 'es']);
  assert.deepEqual(f.calls.sort(), ['de', 'en', 'es']);
  assert.deepEqual(f.reservations, [
    [3, recordings.reduce((sum, item) => sum + item.text.length, 0)],
  ]);
  await createAudioBatch(recordings, f.store, f.synthesize, 'replay');
  assert.equal(f.calls.length, 3);
  assert.equal(f.reservations.length, 1);
  assert.equal(f.owners.size, 0);
});
test('an existing English recording still creates the missing Spanish and German recordings', async () => {
  const f = fixture();
  f.cache.set('en', Buffer.from('existing').toString('base64'));
  const audio = await createAudioBatch(recordings, f.store, f.synthesize, 'owner');
  assert.equal(audio.get('en')?.toString(), 'existing');
  assert.deepEqual(f.calls.sort(), ['de', 'es']);
  assert.equal(f.reservations[0][0], 2);
});
test('insufficient capacity prevents every provider call and releases claims', async () => {
  const f = fixture(false);
  await assert.rejects(
    createAudioBatch(recordings, f.store, f.synthesize, 'owner'),
    AudioQuotaError,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(f.owners.size, 0);
});
test('a provider failure preserves successful languages; retry only synthesizes the missing one', async () => {
  const f = fixture();
  await assert.rejects(
    createAudioBatch(
      recordings,
      f.store,
      async (recording) => {
        if (recording.language === 'es') throw new Error('Provider unavailable');
        return f.synthesize(recording);
      },
      'first',
    ),
  );
  assert.deepEqual([...f.cache.keys()].sort(), ['de', 'en']);
  assert.equal(f.owners.size, 0);
  await createAudioBatch(recordings, f.store, f.synthesize, 'retry');
  assert.deepEqual(f.calls.sort(), ['de', 'en', 'es']);
  assert.equal(f.reservations[1][0], 1);
});
test('simultaneous requests cannot duplicate speech generation', async () => {
  const f = fixture();
  let started!: () => void;
  let finish!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const first = createAudioBatch(
    recordings,
    f.store,
    async (recording) => {
      started();
      await gate;
      return f.synthesize(recording);
    },
    'first',
  );
  await began;
  await assert.rejects(
    createAudioBatch(recordings, f.store, f.synthesize, 'second'),
    AudioPendingError,
  );
  finish();
  await first;
  assert.equal(f.calls.length, 3);
  assert.equal(f.reservations.length, 1);
});
