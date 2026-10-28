import { db, validOrchardId } from '@/lib/db';
import { briefingAudioKey } from '@/lib/briefing-audio';
import { spokenTask, type WorkTask } from '@/lib/work-order';
export const runtime = 'nodejs';
// Read-only playback. A missing recording never triggers provider generation.
export async function POST(request: Request) {
  try {
    const { orchardId, taskId, language, revision } = await request.json();
    if (
      !validOrchardId(orchardId) ||
      typeof taskId !== 'string' ||
      !/^\d+$/.test(taskId) ||
      !['en', 'es'].includes(language)
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
    if (!text) return Response.json({ available: false }, { status: 200 });
    const voice = process.env.ELEVENLABS_VOICE_ID ?? '';
    const key = briefingAudioKey(orchardId, `${language}:${text}`, voice);
    const cached =
      await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE cache_key = ${key} AND orchard_id = ${orchardId} AND audio_base64 IS NOT NULL`;
    if (!cached.length) return Response.json({ available: false });
    return new Response(Buffer.from(cached[0].audio_base64, 'base64'), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Could not load the recording.' }, { status: 503 });
  }
}
