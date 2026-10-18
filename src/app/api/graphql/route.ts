import { buildSchema, graphql } from 'graphql';
import { db, validOrchardId } from '@/lib/db';
import { EXAMPLES, validateStatus, validateWorkInput, type Instructions } from '@/lib/work-order';

export const runtime = 'nodejs';
const schema = buildSchema(`
  type Instructions { title: String!, location: String!, materialsLocation: String!, doneWhen: String! }
  input InstructionsInput { title: String!, location: String!, materialsLocation: String!, doneWhen: String! }
  input WorkInput { species: String!, english: InstructionsInput!, spanish: InstructionsInput }
  type Task { id: ID!, species: String!, title: String!, location: String, materialsLocation: String, doneWhen: String, done: Boolean!, spanish: Instructions, status: String!, helpNote: String!, revision: Int! }
  type Query { tasks(orchardId: ID!): [Task!]! }
  type Mutation {
    startOrchard(orchardId: ID!): [Task!]!
    saveTask(orchardId: ID!, taskId: ID, revision: Int, input: WorkInput!): Task!
    setWorkStatus(orchardId: ID!, taskId: ID!, revision: Int!, status: String!, helpNote: String): Task!
  }
`);
function check(orchardId: string, taskId?: string | null) {
  if (!validOrchardId(orchardId) || (taskId != null && !/^\d+$/.test(taskId)))
    throw new Error('Invalid task details.');
}
function task(row: Record<string, unknown>) {
  return {
    ...row,
    id: String(row.id),
    location: row.location ?? '',
    materialsLocation: row.materials_location ?? '',
    doneWhen: row.done_when ?? '',
    status: row.done ? 'done' : row.work_status,
    helpNote: row.help_note,
  };
}
async function tasks({ orchardId }: { orchardId: string }) {
  check(orchardId);
  const sql = db();
  return (await sql`SELECT * FROM tasks WHERE orchard_id = ${orchardId} ORDER BY id DESC`).map(
    task,
  );
}
const rootValue = {
  tasks,
  async startOrchard({ orchardId }: { orchardId: string }) {
    check(orchardId);
    const sql = db();
    const examples = JSON.stringify(
      EXAMPLES.map((item) => ({ species: item.species, ...item.english, spanish: item.spanish })),
    );
    // Create the workspace and its examples atomically, including concurrent first loads.
    await sql`WITH new_orchard AS (INSERT INTO orchards (id) VALUES (${orchardId}) ON CONFLICT DO NOTHING RETURNING id)
      INSERT INTO tasks (orchard_id, species, title, location, materials_location, done_when, spanish)
      SELECT new_orchard.id, example.species, example.title, example.location, example."materialsLocation", example."doneWhen", example.spanish
      FROM new_orchard CROSS JOIN jsonb_to_recordset(${examples}::jsonb) AS example(species text, title text, location text, "materialsLocation" text, "doneWhen" text, spanish jsonb)`;
    return tasks({ orchardId });
  },
  async saveTask({
    orchardId,
    taskId,
    revision,
    input,
  }: {
    orchardId: string;
    taskId?: string;
    revision?: number;
    input: { species: string; english: Instructions; spanish?: Instructions };
  }) {
    check(orchardId, taskId);
    const { species, english: en, spanish } = validateWorkInput(input);
    const sql = db();
    let rows;
    if (taskId) {
      if (!Number.isInteger(revision)) throw new Error('Reload the task before saving.');
      rows =
        await sql`UPDATE tasks SET species = ${species}, title = ${en.title}, location = ${en.location}, materials_location = ${en.materialsLocation}, done_when = ${en.doneWhen}, spanish = ${spanish ? JSON.stringify(spanish) : null}::jsonb, revision = revision + 1
        WHERE orchard_id = ${orchardId} AND id = ${taskId}::bigint AND revision = ${revision} RETURNING *`;
      if (!rows.length)
        throw new Error(
          'This task changed. Close the editor, refresh the list, and review the latest version.',
        );
    } else {
      rows =
        await sql`INSERT INTO tasks (orchard_id, species, title, location, materials_location, done_when, spanish)
        SELECT ${orchardId}, ${species}, ${en.title}, ${en.location}, ${en.materialsLocation}, ${en.doneWhen}, ${spanish ? JSON.stringify(spanish) : null}::jsonb
        FROM orchards WHERE id = ${orchardId} AND (SELECT count(*) FROM tasks WHERE orchard_id = ${orchardId}) < 20 RETURNING *`;
      if (!rows.length)
        throw new Error('This demo holds up to 20 tasks, or the workspace could not be found.');
    }
    return task(rows[0]);
  },
  async setWorkStatus({
    orchardId,
    taskId,
    revision,
    status,
    helpNote,
  }: {
    orchardId: string;
    taskId: string;
    revision: number;
    status: string;
    helpNote?: string;
  }) {
    check(orchardId, taskId);
    const clean = validateStatus(status, helpNote);
    const sql = db();
    const rows =
      await sql`UPDATE tasks SET work_status = ${clean.status}, done = ${clean.status === 'done'}, help_note = ${clean.helpNote}, revision = revision + 1
      WHERE orchard_id = ${orchardId} AND id = ${taskId}::bigint AND revision = ${revision} RETURNING *`;
    if (!rows.length) throw new Error('This task changed. Refresh the list and try again.');
    return task(rows[0]);
  },
};
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 16000)
      return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body.query !== 'string' || body.query.length > 3000)
      return Response.json({ error: 'Invalid query.' }, { status: 400 });
    const result = await graphql({
      schema,
      source: body.query,
      rootValue,
      variableValues: body.variables,
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Unable to process the request.' }, { status: 400 });
  }
}
