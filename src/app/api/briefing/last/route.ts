import { db, validOrchardId } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let orchardId: unknown;
  let cacheKey: unknown;
  try { ({ orchardId, cacheKey } = await request.json()); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!validOrchardId(orchardId)) return Response.json({ error: 'Invalid orchard ID.' }, { status: 400 });
  if (typeof cacheKey !== 'string' || !/^[0-9a-f]{64}$/.test(cacheKey)) return Response.json({ error: 'Invalid recording.' }, { status: 400 });
  try {
    const sql = db();
    const rows = await sql`SELECT audio_base64 FROM briefing_audio_cache WHERE orchard_id = ${orchardId} AND cache_key = ${cacheKey} AND audio_base64 IS NOT NULL LIMIT 1`;
    if (typeof rows[0]?.audio_base64 !== 'string') return Response.json({ error: 'No saved recording yet.' }, { status: 404 });
    return new Response(Uint8Array.from(Buffer.from(rows[0].audio_base64, 'base64')), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Saved briefing failed', error);
    return Response.json({ error: 'Could not play the saved recording.' }, { status: 500 });
  }
}
