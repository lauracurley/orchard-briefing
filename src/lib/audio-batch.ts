import { AudioPendingError, AudioQuotaError, type AudioStore } from './briefing-audio';
import type { Language } from './work-order';

export type RecordingSpec = { key: string; language: Language; text: string; shared: boolean };
export type BatchAudioStore = Pick<AudioStore, 'load' | 'save' | 'release'> & {
  claim(recording: RecordingSpec, owner: string): Promise<boolean>;
  reserve(requests: number, characters: number): Promise<boolean>;
};

// Claim in a stable language order, then reserve the entire missing set before synthesis.
// A competing request retries from saved audio; it never starts a second provider call.
export async function createAudioBatch(
  recordings: RecordingSpec[],
  store: BatchAudioStore,
  synthesize: (recording: RecordingSpec) => Promise<Uint8Array>,
  owner: string,
): Promise<Map<Language, Buffer>> {
  const audio = new Map<Language, Buffer>();
  const claimed: RecordingSpec[] = [];
  try {
    for (const recording of recordings) {
      const cached = await store.load(recording.key);
      if (cached !== null) {
        audio.set(recording.language, Buffer.from(cached, 'base64'));
      } else if (await store.claim(recording, owner)) {
        claimed.push(recording);
      } else {
        // The competing owner may have finished between our lookup and claim.
        const ready = await store.load(recording.key);
        if (ready === null) throw new AudioPendingError('Recordings are being prepared.');
        audio.set(recording.language, Buffer.from(ready, 'base64'));
      }
    }
    if (!claimed.length) return audio;
    if (
      !(await store.reserve(
        claimed.length,
        claimed.reduce((sum, item) => sum + item.text.length, 0),
      ))
    )
      throw new AudioQuotaError('New recordings are unavailable.');

    // Wait for every result before releasing claims. Successful languages survive a retry.
    const results = await Promise.allSettled(
      claimed.map(async (recording) => {
        const bytes = Buffer.from(await synthesize(recording));
        if (!bytes.length) throw new Error('Empty recording.');
        await store.save(recording.key, owner, bytes.toString('base64'));
        audio.set(recording.language, bytes);
      }),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    return audio;
  } finally {
    await Promise.allSettled(claimed.map((recording) => store.release(recording.key, owner)));
  }
}
