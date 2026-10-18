import { liveVoiceEnabled } from '@/lib/voice-policy';
import { randomUUID } from 'node:crypto';
import { db, validOrchardId } from '@/lib/db';
import { makeBriefing, type BriefingTask } from '@/lib/briefing';
import {
  AudioPendingError,
  AudioQuotaError,
  BRIEFING_FORMAT,
  BRIEFING_MODEL,
  briefingAudioKey,
  getOrCreateBriefingAudio,
  type AudioStore,
} from '@/lib/briefing-audio';

export const runtime = 'nodejs';

class VoiceProviderError extends Error {}

export async function POST(request: Request) {
  let orchardId: unknown;
  try {
    ({ orchardId } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!validOrchardId(orchardId))
    return Response.json({ error: 'Invalid orchard ID.' }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId)
    return Response.json({ error: 'Voice is not configured yet.' }, { status: 503 });

  try {
    const sql = db();
    const rows =
      await sql`SELECT species, title, location, materials_location, done_when, done FROM tasks WHERE orchard_id = ${orchardId} ORDER BY id DESC LIMIT 20`;
    if (!rows.length)
      return Response.json({ error: 'Add a task before listening.' }, { status: 400 });
    const text = makeBriefing(rows as BriefingTask[]);
    const key = briefingAudioKey(orchardId, text, voiceId);
    if (!liveVoiceEnabled()) {
      const cached =
        await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE cache_key = ${key} AND orchard_id = ${orchardId} AND audio_base64 IS NOT NULL`;
      if (!cached.length)
        return Response.json(
          { error: 'New recordings are paused while we prepare the listening experience.' },
          { status: 409 },
        );
      return new Response(Buffer.from(cached[0].audio_base64, 'base64'), {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      });
    }
    const store: AudioStore = {
      async load(cacheKey) {
        const matches =
          await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE cache_key = ${cacheKey} AND audio_base64 IS NOT NULL`;
        return typeof matches[0]?.audio_base64 === 'string' ? matches[0].audio_base64 : null;
      },
      async claim(cacheKey, owner) {
        const claimed =
          await sql`INSERT INTO briefing_audio_cache (cache_key, owner_token, orchard_id) VALUES (${cacheKey}, ${owner}, ${orchardId})
          ON CONFLICT (cache_key) DO UPDATE SET owner_token = EXCLUDED.owner_token, orchard_id = EXCLUDED.orchard_id, reserved_at = now()
          WHERE briefing_audio_cache.audio_base64 IS NULL
            AND briefing_audio_cache.reserved_at < now() - interval '60 seconds'
          RETURNING cache_key`;
        return claimed.length > 0;
      },
      async save(cacheKey, owner, audioBase64) {
        const saved =
          await sql`UPDATE briefing_audio_cache SET audio_base64 = ${audioBase64}, created_at = now()
          WHERE cache_key = ${cacheKey} AND owner_token = ${owner} RETURNING cache_key`;
        if (!saved.length) throw new Error('Audio cache claim expired.');
        try {
          await sql`DELETE FROM briefing_audio_cache WHERE created_at < now() - interval '24 hours' AND cache_key IN (
            SELECT cache_key FROM briefing_audio_cache WHERE audio_base64 IS NOT NULL
            ORDER BY created_at DESC OFFSET 50
          )`;
        } catch (error) {
          console.warn('Could not prune old briefing audio', error);
        }
      },
      async release(cacheKey, owner) {
        await sql`DELETE FROM briefing_audio_cache WHERE cache_key = ${cacheKey} AND owner_token = ${owner} AND audio_base64 IS NULL`;
      },
      async reserveQuota() {
        const quota = await sql`INSERT INTO voice_requests (orchard_id)
          SELECT ${orchardId} FROM orchards WHERE id = ${orchardId}
          AND (SELECT count(*) FROM voice_requests WHERE requested_at >= now() - interval '24 hours') < 25
          AND (SELECT count(*) FROM voice_requests WHERE orchard_id = ${orchardId} AND requested_at >= now() - interval '24 hours') < 2
          RETURNING id`;
        return quota.length ? String(quota[0].id) : null;
      },
      async refundQuota(id) {
        await sql`DELETE FROM voice_requests WHERE id = ${id}`;
      },
    };

    const audio = await getOrCreateBriefingAudio(
      key,
      store,
      async () => {
        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${BRIEFING_FORMAT}`,
          {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, model_id: BRIEFING_MODEL }),
          },
        );
        if (!upstream.ok) {
          let providerCode = 'unknown';
          try {
            const body = await upstream.json();
            if (typeof body?.detail?.status === 'string') providerCode = body.detail.status;
          } catch {
            /* Some provider errors have no JSON body. */
          }
          console.error('ElevenLabs text to speech failed', upstream.status, providerCode);
          throw new VoiceProviderError('The spoken briefing is temporarily unavailable.');
        }
        return new Uint8Array(await upstream.arrayBuffer());
      },
      { owner: randomUUID() },
    );
    return new Response(Uint8Array.from(audio), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AudioQuotaError)
      return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof AudioPendingError)
      return Response.json({ error: error.message }, { status: 503 });
    if (error instanceof VoiceProviderError)
      return Response.json({ error: error.message }, { status: 502 });
    console.error('Briefing failed', error);
    return Response.json({ error: 'The briefing is temporarily unavailable.' }, { status: 500 });
  }
}
