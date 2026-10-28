import { randomUUID } from 'node:crypto';
import { db, validOrchardId } from './db';
import { EXAMPLES, spokenTask, type Language, type WorkTask } from './work-order';
import {
  AudioPendingError,
  AudioQuotaError,
  BRIEFING_FORMAT,
  BRIEFING_MODEL,
  briefingAudioKey,
  getOrCreateBriefingAudio,
  type AudioStore,
} from './briefing-audio';

export const TASK_AUDIO_LIMITS = {
  dailyRequests: 6,
  dailyCharacters: 1200,
  monthlyCharacters: 4000,
  perRecordingCharacters: 600,
} as const;

// Only exact public fixtures share audio between workspaces. Custom task text stays isolated.
export function taskAudioIdentity(
  orchardId: string,
  text: string,
  language: Language,
  voice: string,
) {
  const shared = EXAMPLES.some((example) => {
    const instructions =
      language === 'de' ? example.german : language === 'es' ? example.spanish : example.english;
    return (
      [
        instructions.title,
        instructions.location,
        instructions.materialsLocation,
        instructions.doneWhen,
      ]
        .filter(Boolean)
        .join('. ') === text
    );
  });
  return {
    key: briefingAudioKey(
      shared ? 'public-orchard-examples' : orchardId,
      `${language}:${text}`,
      voice,
    ),
    shared,
  };
}

function audioResponse(audio: Uint8Array) {
  return new Response(Uint8Array.from(audio), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}

export async function serveTaskAudio(request: Request, generate: boolean) {
  try {
    const raw = await request.text();
    if (raw.length > 1000) return Response.json({ error: 'Invalid request.' }, { status: 400 });
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const { orchardId, taskId, language, revision } = input ?? {};
    if (
      !validOrchardId(orchardId) ||
      typeof taskId !== 'string' ||
      !/^\d+$/.test(taskId) ||
      !['en', 'es', 'de'].includes(language) ||
      !Number.isInteger(revision)
    )
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    const sql = db();
    const rows =
      await sql`SELECT * FROM tasks WHERE orchard_id = ${orchardId} AND id = ${taskId}::bigint`;
    if (!rows.length) return Response.json({ error: 'Task not found.' }, { status: 404 });
    const row = rows[0];
    if (row.revision !== revision)
      return Response.json({ error: 'Task changed. Refresh before listening.' }, { status: 409 });
    const text = spokenTask(
      { ...row, materialsLocation: row.materials_location, doneWhen: row.done_when } as WorkTask,
      language,
    );
    if (!text)
      return Response.json(
        { available: false, error: 'Translation required.' },
        { status: generate ? 422 : 200 },
      );
    const voice = process.env.ELEVENLABS_VOICE_ID ?? '';
    const { key, shared } = taskAudioIdentity(orchardId, text, language, voice);
    const cached =
      await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE cache_key = ${key} AND audio_base64 IS NOT NULL`;
    if (cached.length) return audioResponse(Buffer.from(cached[0].audio_base64, 'base64'));
    if (!generate) return Response.json({ available: false });
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || !voice || process.env.ELEVENLABS_TASK_AUDIO_ENABLED === 'false')
      return Response.json({ error: 'Recording is temporarily unavailable.' }, { status: 503 });
    if (text.length > TASK_AUDIO_LIMITS.perRecordingCharacters)
      return Response.json(
        { code: 'instructions_too_long', error: 'Shorten the instructions before recording.' },
        { status: 422 },
      );
    const store: AudioStore = {
      async load(cacheKey) {
        const result =
          await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE cache_key = ${cacheKey} AND audio_base64 IS NOT NULL`;
        return result[0]?.audio_base64 ?? null;
      },
      async claim(cacheKey, owner) {
        const result =
          await sql`INSERT INTO briefing_audio_cache (cache_key, owner_token, orchard_id)
          VALUES (${cacheKey}, ${owner}, ${shared ? null : orchardId})
          ON CONFLICT (cache_key) DO UPDATE SET owner_token = EXCLUDED.owner_token, reserved_at = now()
          WHERE briefing_audio_cache.audio_base64 IS NULL AND briefing_audio_cache.reserved_at < now() - interval '60 seconds'
          RETURNING cache_key`;
        return result.length > 0;
      },
      async save(cacheKey, owner, audioBase64) {
        const result =
          await sql`UPDATE briefing_audio_cache SET audio_base64 = ${audioBase64}, created_at = now()
          WHERE cache_key = ${cacheKey} AND owner_token = ${owner} RETURNING cache_key`;
        if (!result.length) throw new Error('Recording reservation expired.');
      },
      async release(cacheKey, owner) {
        await sql`DELETE FROM briefing_audio_cache WHERE cache_key = ${cacheKey} AND owner_token = ${owner} AND audio_base64 IS NULL`;
      },
      async reserveQuota() {
        // A single atomic row update serializes reservations across all visitors and server instances.
        const result =
          await sql`INSERT INTO task_audio_budget (id, day, daily_requests, daily_characters, month, monthly_characters)
          VALUES (1, (now() AT TIME ZONE 'UTC')::date, 1, ${text.length}, date_trunc('month', now() AT TIME ZONE 'UTC')::date, ${text.length})
          ON CONFLICT (id) DO UPDATE SET
            day = EXCLUDED.day,
            daily_requests = CASE WHEN task_audio_budget.day = EXCLUDED.day THEN task_audio_budget.daily_requests + 1 ELSE 1 END,
            daily_characters = CASE WHEN task_audio_budget.day = EXCLUDED.day THEN task_audio_budget.daily_characters + EXCLUDED.daily_characters ELSE EXCLUDED.daily_characters END,
            month = EXCLUDED.month,
            monthly_characters = CASE WHEN task_audio_budget.month = EXCLUDED.month THEN task_audio_budget.monthly_characters + EXCLUDED.monthly_characters ELSE EXCLUDED.monthly_characters END
          WHERE (CASE WHEN task_audio_budget.day = EXCLUDED.day THEN task_audio_budget.daily_requests ELSE 0 END) < ${TASK_AUDIO_LIMITS.dailyRequests}
            AND (CASE WHEN task_audio_budget.day = EXCLUDED.day THEN task_audio_budget.daily_characters ELSE 0 END) + EXCLUDED.daily_characters <= ${TASK_AUDIO_LIMITS.dailyCharacters}
            AND (CASE WHEN task_audio_budget.month = EXCLUDED.month THEN task_audio_budget.monthly_characters ELSE 0 END) + EXCLUDED.monthly_characters <= ${TASK_AUDIO_LIMITS.monthlyCharacters}
          RETURNING id`;
        return result.length ? 'reserved' : null;
      },
      async refundQuota() {
        // Conservatively retain the reservation: a timeout may still have consumed provider credits.
      },
    };
    const audio = await getOrCreateBriefingAudio(
      key,
      store,
      async () => {
        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${BRIEFING_FORMAT}`,
          {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, model_id: BRIEFING_MODEL }),
            signal: AbortSignal.timeout(25000),
          },
        );
        if (!upstream.ok) throw new Error('Speech provider unavailable.');
        return new Uint8Array(await upstream.arrayBuffer());
      },
      { owner: randomUUID() },
    );
    return audioResponse(audio);
  } catch (error) {
    if (error instanceof AudioQuotaError)
      return Response.json(
        {
          error:
            'New recordings are unavailable right now. Existing recordings can still be played.',
        },
        { status: 429 },
      );
    if (error instanceof AudioPendingError)
      return Response.json(
        { error: 'Recording is being prepared. Try again shortly.' },
        { status: 409 },
      );
    return Response.json(
      { error: 'Could not prepare the recording. Please try again later.' },
      { status: 503 },
    );
  }
}
