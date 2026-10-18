import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AudioQuotaError,
  briefingAudioKey,
  getOrCreateBriefingAudio,
  type AudioStore,
} from '../src/lib/briefing-audio';

function memoryStore() {
  const audio = new Map<string, string>();
  const claims = new Set<string>();
  let reservations = 0;
  let refunds = 0;
  const store: AudioStore = {
    async load(key) {
      return audio.get(key) ?? null;
    },
    async claim(key) {
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    async save(key, _owner, value) {
      audio.set(key, value);
    },
    async release(key) {
      claims.delete(key);
    },
    async reserveQuota() {
      reservations++;
      return String(reservations);
    },
    async refundQuota() {
      refunds++;
    },
  };
  return { store, counts: () => ({ reservations, refunds }) };
}

test('the same briefing and voice reuse saved audio without another synthesis or quota request', async () => {
  const { store, counts } = memoryStore();
  const key = briefingAudioKey('orchard-one', 'Check guards.', 'voice-one');
  let syntheses = 0;
  const synthesize = async () => {
    syntheses++;
    return new Uint8Array([1, 2, 3]);
  };
  const first = await getOrCreateBriefingAudio(key, store, synthesize, { owner: 'first' });
  const second = await getOrCreateBriefingAudio(key, store, synthesize, { owner: 'second' });
  assert.deepEqual(first, second);
  assert.equal(syntheses, 1);
  assert.deepEqual(counts(), { reservations: 1, refunds: 0 });
});

test('a changed briefing or voice gets a distinct cache key', () => {
  const key = briefingAudioKey('orchard-one', 'Check guards.', 'voice-one');
  assert.notEqual(key, briefingAudioKey('orchard-one', 'Check guards and stakes.', 'voice-one'));
  assert.notEqual(key, briefingAudioKey('orchard-one', 'Check guards.', 'voice-two'));
  assert.notEqual(key, briefingAudioKey('orchard-two', 'Check guards.', 'voice-one'));
});

test('a simultaneous listener waits for the first recording instead of synthesizing twice', async () => {
  const { store, counts } = memoryStore();
  let signalStarted!: () => void;
  let finishSynthesis!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const finish = new Promise<void>((resolve) => {
    finishSynthesis = resolve;
  });
  const first = getOrCreateBriefingAudio(
    'shared-key',
    store,
    async () => {
      signalStarted();
      await finish;
      return new Uint8Array([7]);
    },
    { owner: 'first' },
  );
  await started;
  let duplicateSynthesis = false;
  const second = getOrCreateBriefingAudio(
    'shared-key',
    store,
    async () => {
      duplicateSynthesis = true;
      return new Uint8Array([8]);
    },
    {
      owner: 'second',
      wait: async () => {
        finishSynthesis();
        await first;
      },
      maxWaits: 1,
    },
  );
  assert.deepEqual([...(await second)], [7]);
  assert.equal(duplicateSynthesis, false);
  assert.deepEqual(counts(), { reservations: 1, refunds: 0 });
});

test('a failed synthesis releases its quota and allows a retry', async () => {
  const { store, counts } = memoryStore();
  const key = briefingAudioKey('orchard-one', 'Check guards.', 'voice-one');
  await assert.rejects(
    getOrCreateBriefingAudio(
      key,
      store,
      async () => {
        throw new Error('provider failed');
      },
      { owner: 'first' },
    ),
  );
  assert.deepEqual(counts(), { reservations: 1, refunds: 1 });
  const audio = await getOrCreateBriefingAudio(key, store, async () => new Uint8Array([4]), {
    owner: 'second',
  });
  assert.deepEqual([...audio], [4]);
});

test('a quota rejection does not call ElevenLabs', async () => {
  const { store } = memoryStore();
  store.reserveQuota = async () => null;
  let called = false;
  await assert.rejects(
    getOrCreateBriefingAudio(
      'key',
      store,
      async () => {
        called = true;
        return new Uint8Array([1]);
      },
      { owner: 'first' },
    ),
    AudioQuotaError,
  );
  assert.equal(called, false);
});
