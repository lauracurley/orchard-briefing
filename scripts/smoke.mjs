// Opt-in deployment check. Creates one isolated fictional workspace; never calls a voice provider.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.ORCHARD_SMOKE_URL;
if (!base) throw new Error('Set ORCHARD_SMOKE_URL to the deployment you intend to verify.');
const orchardId = randomUUID();
const fields =
  'id species title location materialsLocation doneWhen spanish { title location materialsLocation doneWhen } german { title location materialsLocation doneWhen } status helpNote revision';
async function post(path, body) {
  const response = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.json() };
}
async function graphql(query, variables = {}) {
  return (await post('/api/graphql', { query, variables: { orchardId, ...variables } })).body;
}
const started = await graphql(
  `mutation($orchardId: ID!) { startOrchard(orchardId: $orchardId) { ${fields} } }`,
);
assert.equal(started.errors, undefined, JSON.stringify(started.errors));
assert.equal(started.data.startOrchard.length, 3);
assert.ok(started.data.startOrchard.every((task) => task.spanish?.title && task.german?.title));
const save = `mutation($orchardId: ID!, $taskId: ID, $revision: Int, $input: WorkInput!) { saveTask(orchardId: $orchardId, taskId: $taskId, revision: $revision, input: $input) { ${fields} } }`;
const input = {
  species: 'Chestnut',
  english: {
    title: 'Check the example guards',
    location: 'Demo row',
    materialsLocation: 'Spare ties: Demo shed',
    doneWhen: 'All guards checked',
  },
  german: {
    title: 'Die Beispiel-Schutzhüllen prüfen',
    location: 'Beispielreihe',
    materialsLocation: 'Bindematerial: Beispielschuppen',
    doneWhen: 'Alle Schutzhüllen geprüft',
  },
  spanish: {
    title: 'Revisar los protectores de muestra',
    location: 'Fila de muestra',
    materialsLocation: 'Ataduras: cobertizo de muestra',
    doneWhen: 'Todos los protectores revisados',
  },
};
const added = await graphql(save, { input });
assert.equal(added.errors, undefined, JSON.stringify(added.errors));
const task = added.data.saveTask;
const updated = await graphql(save, {
  input: {
    ...input,
    english: { ...input.english, materialsLocation: 'Spare ties: Demo office' },
    spanish: { ...input.spanish, materialsLocation: 'Ataduras: oficina de muestra' },
    german: { ...input.german, materialsLocation: 'Bindematerial: Beispielbüro' },
  },
  taskId: task.id,
  revision: task.revision,
});
assert.equal(updated.errors, undefined, JSON.stringify(updated.errors));
assert.equal(updated.data.saveTask.revision, task.revision + 1);
const stale = await graphql(save, { input, taskId: task.id, revision: task.revision });
assert.match(stale.errors[0].message, /changed/);
const incomplete = await graphql(save, {
  input: { ...input, spanish: { ...input.spanish, location: '' } },
});
assert.match(incomplete.errors[0].message, /Spanish/);
const incompleteGerman = await graphql(save, {
  input: { ...input, german: { ...input.german, location: '' } },
});
assert.match(incompleteGerman.errors[0].message, /German/);
const statusQuery = `mutation($orchardId: ID!, $taskId: ID!, $revision: Int!, $status: String!, $helpNote: String) { setWorkStatus(orchardId: $orchardId, taskId: $taskId, revision: $revision, status: $status, helpNote: $helpNote) { ${fields} } }`;
const blocked = await graphql(statusQuery, {
  taskId: task.id,
  revision: updated.data.saveTask.revision,
  status: 'blocked',
  helpNote: 'The demo shed is locked.',
});
assert.equal(blocked.errors, undefined, JSON.stringify(blocked.errors));
assert.equal(blocked.data.setWorkStatus.status, 'blocked');
const crossWorkspace = await graphql(statusQuery, {
  orchardId: randomUUID(),
  taskId: task.id,
  revision: blocked.data.setWorkStatus.revision,
  status: 'done',
});
assert.ok(crossWorkspace.errors?.length);
const persisted = await graphql(
  `query($orchardId: ID!) { tasks(orchardId: $orchardId) { ${fields} } }`,
);
assert.equal(
  persisted.data.tasks.find((item) => item.id === task.id).helpNote,
  'The demo shed is locked.',
);
assert.equal(
  persisted.data.tasks.find((item) => item.id === task.id).german.materialsLocation,
  'Bindematerial: Beispielbüro',
);
const audio = await post('/api/task-audio', {
  orchardId,
  taskId: task.id,
  revision: blocked.data.setWorkStatus.revision,
  language: 'de',
});
assert.deepEqual(audio.body, { available: false });
for (const endpoint of ['transcribe', 'agent-session'])
  assert.equal((await post('/api/' + endpoint, {})).status, 503);
console.log(
  'Deployment smoke check passed: three-language publish/edit, conflict protection, blocker persistence, workspace isolation, cache miss and capture locks. No voice generation requested.',
);
