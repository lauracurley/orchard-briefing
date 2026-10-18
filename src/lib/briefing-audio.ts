import { createHash } from 'node:crypto';

export const BRIEFING_MODEL = 'eleven_multilingual_v2';
export const BRIEFING_FORMAT = 'mp3_44100_128';

export function briefingAudioKey(orchardId: string, text: string, voiceId: string): string {
  return createHash('sha256').update(JSON.stringify([orchardId, BRIEFING_MODEL, BRIEFING_FORMAT, voiceId, text])).digest('hex');
}

export class AudioQuotaError extends Error {}
export class AudioPendingError extends Error {}

export type AudioStore = {
  load(key: string): Promise<string | null>;
  claim(key: string, owner: string): Promise<boolean>;
  save(key: string, owner: string, audioBase64: string): Promise<void>;
  release(key: string, owner: string): Promise<void>;
  reserveQuota(): Promise<string | null>;
  refundQuota(id: string): Promise<void>;
};

export async function getOrCreateBriefingAudio(
  key: string,
  store: AudioStore,
  synthesize: () => Promise<Uint8Array>,
  options: { owner: string; wait?: (ms: number) => Promise<void>; maxWaits?: number },
): Promise<Buffer> {
  const cached = await store.load(key);
  if (cached !== null) return Buffer.from(cached, 'base64');

  if (!await store.claim(key, options.owner)) {
    const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    for (let attempt = 0; attempt < (options.maxWaits ?? 24); attempt++) {
      await wait(250);
      const ready = await store.load(key);
      if (ready !== null) return Buffer.from(ready, 'base64');
    }
    throw new AudioPendingError('The briefing is being prepared. Please try again in a moment.');
  }

  let quotaId: string | null = null;
  let synthesized = false;
  try {
    quotaId = await store.reserveQuota();
    if (!quotaId) throw new AudioQuotaError('Today’s listening limit has been reached. Please try again tomorrow.');
    const audio = Buffer.from(await synthesize());
    if (audio.length === 0) throw new Error('The voice service returned no audio.');
    synthesized = true;
    await store.save(key, options.owner, audio.toString('base64'));
    return audio;
  } catch (error) {
    if (quotaId && !synthesized) await store.refundQuota(quotaId);
    throw error;
  } finally {
    await store.release(key, options.owner);
  }
}
