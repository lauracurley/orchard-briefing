import { db, validOrchardId } from '@/lib/db';
import { readTranscript, validateAudio } from '@/lib/voice-note';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (process.env.ELEVENLABS_CAPTURE_ENABLED !== 'true') {
    return Response.json({ error: 'Recording suggestions are coming soon. You can type or try a sample note.' }, { status: 503 });
  }
  const apiKey = process.env.ELEVENLABS_SPEECH_API_KEY;
  if (!apiKey) return Response.json({ error: 'Recording is not available yet.' }, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > 1_600_000) {
    return Response.json({ error: 'The recording is too large. Keep it under 20 seconds.' }, { status: 413 });
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Invalid recording.' }, { status: 400 }); }
  const orchardId = form.get('orchardId');
  const audio = form.get('audio');
  if (!validOrchardId(orchardId) || !(audio instanceof File)) {
    return Response.json({ error: 'Invalid recording.' }, { status: 400 });
  }
  try { validateAudio(audio); } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid recording.' }, { status: 400 });
  }

  let reservedId: string | number | null = null;
  try {
    const sql = db();
    const quota = await sql`INSERT INTO transcription_requests (orchard_id)
      SELECT ${orchardId} FROM orchards WHERE id = ${orchardId}
      AND (SELECT count(*) FROM transcription_requests WHERE requested_at >= now() - interval '24 hours') < 12
      AND (SELECT count(*) FROM transcription_requests WHERE orchard_id = ${orchardId} AND requested_at >= now() - interval '24 hours') < 1
      RETURNING id`;
    if (!quota.length) return Response.json({ error: 'The recording limit has been reached. Try typing your note instead.' }, { status: 429 });
    reservedId = quota[0].id;

    const upstreamForm = new FormData();
    upstreamForm.set('file', audio, audio.name || 'field-note.webm');
    upstreamForm.set('model_id', 'scribe_v2');
    upstreamForm.set('language_code', 'eng');
    const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST', headers: { 'xi-api-key': apiKey }, body: upstreamForm, signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      console.error('ElevenLabs transcription failed', upstream.status);
      throw new Error('Transcription failed.');
    }
    const transcript = readTranscript(await upstream.json());
    return Response.json({ transcript }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    if (reservedId !== null) {
      try { const sql = db(); await sql`DELETE FROM transcription_requests WHERE id = ${reservedId}`; } catch { /* Keep the public response generic. */ }
    }
    return Response.json({ error: 'The recording could not be transcribed. Please type your note.' }, { status: 502 });
  }
}
