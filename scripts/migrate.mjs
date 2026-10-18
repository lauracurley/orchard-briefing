import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS orchards (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orchard_id uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
  species text NOT NULL CHECK (species IN ('Chestnut', 'Walnut', 'Heartnut', 'Hazel')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS tasks_orchard_id_idx ON tasks (orchard_id, id)`;
await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location text`;
await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_when text`;
await sql`CREATE TABLE IF NOT EXISTS voice_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orchard_id uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS voice_requests_requested_at_idx ON voice_requests (requested_at)`;
await sql`CREATE TABLE IF NOT EXISTS transcription_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orchard_id uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS transcription_requests_requested_at_idx ON transcription_requests (requested_at)`;
await sql`CREATE TABLE IF NOT EXISTS agent_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orchard_id uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS agent_sessions_requested_at_idx ON agent_sessions (requested_at)`;
await sql`CREATE TABLE IF NOT EXISTS briefing_audio_cache (
  cache_key text PRIMARY KEY,
  owner_token uuid NOT NULL,
  audio_base64 text,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz
)`;
console.log('Database ready');
