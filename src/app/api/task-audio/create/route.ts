import { serveTaskAudio } from '@/lib/task-audio';
export const runtime = 'nodejs';
export const maxDuration = 60;
// Explicit user action only; shares an atomic site-wide budget across all visitors.
export async function POST(request: Request) {
  return serveTaskAudio(request, true);
}
