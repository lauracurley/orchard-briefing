import { liveVoiceEnabled } from '@/lib/voice-policy';
import { db, validOrchardId } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!liveVoiceEnabled() || process.env.ELEVENLABS_CAPTURE_ENABLED !== 'true') {
    return Response.json(
      { error: 'Task suggestions are coming soon. You can write or try a sample task.' },
      { status: 503 },
    );
  }
  const apiKey = process.env.ELEVENLABS_AGENT_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId)
    return Response.json({ error: 'Task suggestions are not available yet.' }, { status: 503 });

  let orchardId: unknown;
  try {
    ({ orchardId } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!validOrchardId(orchardId))
    return Response.json({ error: 'Invalid orchard ID.' }, { status: 400 });

  let reservedId: string | number | null = null;
  try {
    const sql = db();
    const quota = await sql`INSERT INTO agent_sessions (orchard_id)
      SELECT ${orchardId} FROM orchards WHERE id = ${orchardId}
      AND (SELECT count(*) FROM agent_sessions WHERE requested_at >= now() - interval '24 hours') < 12
      AND (SELECT count(*) FROM agent_sessions WHERE orchard_id = ${orchardId} AND requested_at >= now() - interval '24 hours') < 1
      RETURNING id`;
    if (!quota.length)
      return Response.json(
        {
          error: 'Today’s suggestion limit has been reached. You can still edit the task yourself.',
        },
        { status: 429 },
      );
    reservedId = quota[0].id;

    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
    url.searchParams.set('agent_id', agentId);
    url.searchParams.set('include_conversation_id', 'true');
    const upstream = await fetch(url, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      console.error('ElevenLabs agent session failed', upstream.status);
      throw new Error('Agent session failed.');
    }
    const payload = await upstream.json();
    if (typeof payload.signed_url !== 'string' || !payload.signed_url.startsWith('wss://')) {
      throw new Error('Agent session failed.');
    }
    return Response.json(
      { signedUrl: payload.signed_url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    if (reservedId !== null) {
      try {
        const sql = db();
        await sql`DELETE FROM agent_sessions WHERE id = ${reservedId}`;
      } catch {
        /* Keep the public response generic. */
      }
    }
    return Response.json(
      { error: 'Task suggestions are temporarily unavailable.' },
      { status: 502 },
    );
  }
}
