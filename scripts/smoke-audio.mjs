// Opt-in LIVE test: one action may create all three short public example recordings.
// Normal CI and the text smoke test never run this script.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

const base = process.env.ORCHARD_SMOKE_URL;
if (!base || process.env.ORCHARD_ALLOW_PAID_SMOKE !== 'true')
  throw new Error(
    'Set ORCHARD_SMOKE_URL and explicitly set ORCHARD_ALLOW_PAID_SMOKE=true. This test can consume speech credits.',
  );
const languages = ['en', 'es', 'de'];
async function post(path, body) {
  return fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
}
async function example() {
  const orchardId = randomUUID();
  const response = await post('/api/graphql', {
    query:
      'mutation($orchardId: ID!) { startOrchard(orchardId: $orchardId) { id species revision } }',
    variables: { orchardId },
  });
  const result = await response.json();
  assert.equal(result.errors, undefined);
  const task = result.data.startOrchard.find((task) => task.species === 'Walnut');
  assert.ok(task);
  return { orchardId, taskId: task.id, revision: task.revision };
}
const first = await example();
const second = await example();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// A request from any language must prepare the full set, including when its own audio exists.
const created = await post('/api/task-audio/create', { ...first, language: 'de' });
assert.equal(created.status, 200, 'Creating the three-language set failed');
assert.equal(created.headers.get('x-recordings-complete'), 'true');
for (const language of languages) {
  const recording = await post('/api/task-audio', { ...first, language });
  assert.equal(recording.status, 200, `Recording failed for ${language}`);
  assert.ok(recording.headers.get('content-type')?.includes('audio/'));
  const bytes = Buffer.from(await recording.arrayBuffer());
  assert.ok(bytes.length > 1000);
  const replay = await post('/api/task-audio', { ...second, language });
  assert.equal(replay.status, 200);
  assert.ok(replay.headers.get('content-type')?.includes('audio/'));
  assert.equal(digest(Buffer.from(await replay.arrayBuffer())), digest(bytes));
  console.log(
    `${language}: available after one creation action; another workspace received identical cached audio.`,
  );
}
