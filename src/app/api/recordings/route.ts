import { db, validOrchardId } from '@/lib/db';
export async function POST(request: Request) {
  try {
    const { orchardId } = await request.json();
    if (!validOrchardId(orchardId))
      return Response.json({ error: 'Invalid workspace.' }, { status: 400 });
    const sql = db();
    const rows =
      await sql`SELECT cache_key AS "cacheKey", created_at AS "createdAt" FROM briefing_audio_cache WHERE orchard_id = ${orchardId} AND audio_base64 IS NOT NULL ORDER BY created_at DESC LIMIT 5`;
    return Response.json({ recordings: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not load saved recordings.' }, { status: 503 });
  }
}
