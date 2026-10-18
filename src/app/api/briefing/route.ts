import { db, validOrchardId } from '@/lib/db';
import { makeBriefing, type BriefingTask } from '@/lib/briefing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let orchardId: unknown;
  try { ({ orchardId } = await request.json()); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!validOrchardId(orchardId)) return Response.json({ error: 'Invalid orchard ID.' }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return Response.json({ error: 'Voice is not configured yet.' }, { status: 503 });

  try {
    const sql = db();
    const rows = await sql`SELECT species, title, done FROM tasks WHERE orchard_id = ${orchardId} ORDER BY id DESC LIMIT 20`;
    if (!rows.length) return Response.json({ error: 'Add a task before listening.' }, { status: 400 });
    const quota = await sql`INSERT INTO voice_requests (orchard_id)
      SELECT ${orchardId} FROM orchards WHERE id = ${orchardId}
      AND (SELECT count(*) FROM voice_requests WHERE requested_at >= now() - interval '24 hours') < 25
      AND (SELECT count(*) FROM voice_requests WHERE orchard_id = ${orchardId} AND requested_at >= now() - interval '24 hours') < 2
      RETURNING id`;
    if (!quota.length) return Response.json({ error: 'Today’s listening limit has been reached. Please try again tomorrow.' }, { status: 429 });
    const text = makeBriefing(rows as BriefingTask[]);
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    });
    if (!upstream.ok) return Response.json({ error: 'The spoken briefing is temporarily unavailable.' }, { status: 502 });
    return new Response(upstream.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'The briefing is temporarily unavailable.' }, { status: 500 });
  }
}
