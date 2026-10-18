# Orchard Briefing

A small field-note and work-list demo for nut orchards. Record a rough note, review a clear task, and hear the open work before heading into the rows.

**Live demo:** https://orchard-briefing.vercel.app/

The public demo uses fictional orchard data. Lists are scoped to a random ID in each browser; there are no user accounts, shared crews, or private operational records.

## Stack and speech flow

- Next.js, React, TypeScript, and GraphQL
- Neon PostgreSQL for demo tasks and usage limits
- ElevenLabs Scribe v2 for short speech-to-text capture
- ElevenAgents Chat Mode for a proposed task and one follow-up question when a note is unclear
- ElevenLabs text-to-speech for the approved open-task briefing

The grower reviews and approves every proposed task before the GraphQL mutation saves it. The agent can only populate an editable form through a client tool; it has no database write tool. Raw recordings and transcripts are not persisted. The server keeps ElevenLabs keys private. The [agent configuration](docs/elevenlabs-agent.md) documents its prompt, client tool, and approval boundary.

The capture/agent flow is **off by default**. With it off, visitors can inspect a sample note and task, edit tasks, and use the existing spoken briefing. Turning it on requires the separate Scribe and ElevenAgents keys, an agent ID, and an explicit environment flag. Automated tests use no ElevenLabs credits.

## Run locally

1. Use Node.js 22.22 or later, then run `npm install`.
2. Copy `.env.example` to `.env.local`. Set `DATABASE_URL`; set the text-to-speech key and voice ID if you want the existing Listen action.
3. Run `npm run db:migrate` against the demo database.
4. Run `npm run dev` and open http://localhost:3000/.

The first visit seeds three fictional tasks. The sample note/task button demonstrates the review flow without calling ElevenLabs. To enable live note capture, configure the [agent](docs/elevenlabs-agent.md), set `ELEVENLABS_SPEECH_API_KEY`, `ELEVENLABS_AGENT_API_KEY`, and `ELEVENLABS_AGENT_ID`, then set `ELEVENLABS_CAPTURE_ENABLED=true` and restart. The text-to-speech key is separate.

## Deploy

Import this repo into Vercel, set the environment variables in the project settings, run the database migration against Neon, and deploy. Keep `.env.local` and all credentials out of GitHub. The capture/agent flag should stay `false` until you deliberately approve live usage. Run the migration before deploying code that reads the new task columns.

This is a **personal, noncommercial portfolio demo**. [Vercel Hobby](https://vercel.com/legal/terms) is limited to personal or noncommercial use, and [ElevenLabs Free](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) does not include a commercial license. Using this for real orchard operations would require a separate hosting and licensing decision.

## Usage controls and quality checks

- Transcription and agent sessions are each capped at one attempt per browser ID and 12 total in a rolling 24 hours. Audio uploads are limited to 1.5 MB; the browser recording stops at 20 seconds. These limits protect a tiny public demo; browser IDs are not authentication.
- The spoken briefing retains its existing limit of two requests per browser ID and 25 total in 24 hours. Replaying an unchanged briefing in the same page session reuses its audio without another API call.
- The agent session uses a signed URL from a server route, and the agent should be configured as text-only with a 60-second maximum duration. The client tool never saves a task.
- Run `npm run lint && npm run typecheck && npm test && npm run build`. Tests cover task wording and validation without calling ElevenLabs.

No real orchard records, employee information, or credentials belong in this repository or the public demo database.
