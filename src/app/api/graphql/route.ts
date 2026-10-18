import { buildSchema, graphql } from 'graphql';
import { db, validOrchardId } from '@/lib/db';
import { cleanTitle, isSpecies } from '@/lib/briefing';

export const runtime = 'nodejs';

const schema = buildSchema(`
  type Task { id: ID!, species: String!, title: String!, done: Boolean! }
  type Query { tasks(orchardId: ID!): [Task!]! }
  type Mutation {
    startOrchard(orchardId: ID!): [Task!]!
    addTask(orchardId: ID!, species: String!, title: String!): Task!
    setTaskDone(orchardId: ID!, taskId: ID!, done: Boolean!): Task!
  }
`);

async function tasks(orchardId: string) {
  if (!validOrchardId(orchardId)) throw new Error('Invalid orchard ID.');
  const sql = db();
  return sql`SELECT id::text, species, title, done FROM tasks WHERE orchard_id = ${orchardId} ORDER BY id DESC`;
}

const rootValue = {
  tasks,
  async startOrchard({ orchardId }: { orchardId: string }) {
    if (!validOrchardId(orchardId)) throw new Error('Invalid orchard ID.');
    const sql = db();
    const inserted = await sql`INSERT INTO orchards (id) VALUES (${orchardId}) ON CONFLICT DO NOTHING RETURNING id`;
    if (inserted.length) {
      await sql`INSERT INTO tasks (orchard_id, species, title) VALUES
        (${orchardId}, 'Chestnut', 'Walk the young tree rows and note weather damage'),
        (${orchardId}, 'Hazel', 'Check guards and record any browsing'),
        (${orchardId}, 'Walnut', 'Photograph one representative tree for the season log')`;
    }
    return tasks(orchardId);
  },
  async addTask({ orchardId, species, title }: { orchardId: string; species: string; title: string }) {
    if (!validOrchardId(orchardId) || !isSpecies(species)) throw new Error('Invalid task details.');
    const clean = cleanTitle(title);
    const sql = db();
    const count = await sql`SELECT count(*)::int AS count FROM tasks WHERE orchard_id = ${orchardId}`;
    if (count[0].count >= 20) throw new Error('This small demo holds up to 20 tasks.');
    const rows = await sql`INSERT INTO tasks (orchard_id, species, title) VALUES (${orchardId}, ${species}, ${clean}) RETURNING id::text, species, title, done`;
    return rows[0];
  },
  async setTaskDone({ orchardId, taskId, done }: { orchardId: string; taskId: string; done: boolean }) {
    if (!validOrchardId(orchardId) || !/^\d+$/.test(taskId)) throw new Error('Invalid task details.');
    const sql = db();
    const rows = await sql`UPDATE tasks SET done = ${done} WHERE id = ${taskId}::bigint AND orchard_id = ${orchardId} RETURNING id::text, species, title, done`;
    if (!rows.length) throw new Error('Task not found.');
    return rows[0];
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.query !== 'string' || body.query.length > 3000) return Response.json({ error: 'Invalid query.' }, { status: 400 });
    const result = await graphql({ schema, source: body.query, rootValue, variableValues: body.variables });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Unable to process the request.' }, { status: 400 });
  }
}
