export const MAX_NOTE_BYTES = 1_500_000;
export const MAX_NOTE_SECONDS = 20;

const AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav']);

export function validateAudio(file: File): void {
  const type = file.type.split(';')[0].toLowerCase();
  if (!AUDIO_TYPES.has(type)) throw new Error('Please use a short audio recording.');
  if (file.size < 100 || file.size > MAX_NOTE_BYTES) throw new Error('The recording is too large. Keep it under 20 seconds.');
}

export function readTranscript(value: unknown): string {
  if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') {
    throw new Error('The recording could not be transcribed.');
  }
  const text = value.text.trim();
  if (!text || text.length > 1500) throw new Error('The recording could not be transcribed.');
  return text;
}
