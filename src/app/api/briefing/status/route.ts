import { db, validOrchardId } from '@/lib/db';
import { makeBriefing, type BriefingTask } from '@/lib/briefing';
import { briefingAudioKey } from '@/lib/briefing-audio';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let orchardId: unknown;
  try {
    ({ orchardId } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!validOrchardId(orchardId))
    return Response.json({ error: 'Invalid orchard ID.' }, { status: 400 });
  try {
    const sql = db();
    const tasks =
      await sql`SELECT species, title, location, materials_location, done_when, done FROM tasks WHERE orchard_id = ${orchardId} ORDER BY id DESC LIMIT 20`;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const currentKey =
      tasks.length && voiceId
        ? briefingAudioKey(orchardId, makeBriefing(tasks as BriefingTask[]), voiceId)
        : null;
    const saved =
      await sql`SELECT cache_key FROM briefing_audio_cache WHERE orchard_id = ${orchardId} AND audio_base64 IS NOT NULL AND (${currentKey}::text IS NULL OR cache_key <> ${currentKey}) ORDER BY created_at DESC LIMIT 1`;
    const current = currentKey
      ? await sql`SELECT cache_key FROM briefing_audio_cache WHERE cache_key = ${currentKey} AND audio_base64 IS NOT NULL LIMIT 1`
      : [];
    return Response.json({
      currentCached: current.length > 0,
      previousKey: saved[0]?.cache_key ?? null,
    });
  } catch (error) {
    console.error('Briefing status failed', error);
    return Response.json({ error: 'Could not check saved recordings.' }, { status: 500 });
  }
}
