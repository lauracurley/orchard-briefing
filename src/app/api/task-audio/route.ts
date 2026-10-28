import { serveTaskAudio } from '@/lib/task-audio';
export const runtime = 'nodejs';
// Read-only lookup. A cache miss never synthesizes speech.
export async function POST(request: Request) {
  return serveTaskAudio(request, false);
}
