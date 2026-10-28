# Orchard Briefing

Orchard tasks need more than a title: where to go, where the materials are, and what counts as finished.

Orchard Briefing lets someone prepare those instructions, review them in English, Spanish, or German, and publish them for the team. People doing the work can read or listen to the instructions, update progress, and flag a problem.

**[Try the demo](https://orchard-briefing.vercel.app/)** · [Development guide](docs/development.md)

## Try it

1. In **Plan work**, choose **Try a translated example** and review the instructions.
2. Check the review box and publish the task.
3. Switch to **Today’s tasks** and choose English, Español, or Deutsch.
4. Play the saved instructions, or choose **Create recordings in all languages** to prepare English, Spanish, and German together.
5. Start the task, mark it done, or request help. Return to **Plan work** to see the update.

Both views share this browser’s workspace. Examples include prepared translations; custom translations are entered manually. New recordings have a small shared limit, so existing audio remains available when generation is unavailable.

## How it works

The React interface calls a GraphQL API for task publication and progress updates. PostgreSQL stores instructions, translations, revisions, and audio. A separate server route calls ElevenLabs text-to-speech for all three reviewed versions of the task. API keys stay on the server.

Built with TypeScript, Next.js, React, GraphQL, Neon PostgreSQL, and ElevenLabs Multilingual v2. Hosted on Vercel.

Three decisions shape the implementation:

- **Reuse recordings.** Exact instructions, language, voice, model, and format determine the audio cache key. Status changes reuse audio; changes to spoken text require a new recording. Only exact public examples share recordings across workspaces.
- **Reject stale edits.** Updates include the task’s revision. The server rejects conflicts rather than overwriting newer work. Included translations are reviewed and published with the English instructions.
- **Bound speech usage.** One recording action reserves a shared budget atomically for all missing languages before generating audio. Concurrent requests for the same recording share a reservation; playback never generates speech.

Start with the [task model](src/lib/work-order.ts), [GraphQL API](src/app/api/graphql/route.ts), or [audio implementation](src/lib/task-audio.ts). [Design notes](docs/product-design.md) explain the workflow and interface references.

## Run locally

Use Node.js 22.22 or later and a Neon PostgreSQL database.

```sh
npm ci
cp .env.example .env.local
# Set DATABASE_URL in .env.local.
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

Open http://localhost:3000/. To create recordings, also set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. Keep credentials out of Git. The [development guide](docs/development.md) covers the database-free UI preview, deployment, and recording limits.

## Tests

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests cover task validation, translation requirements, and audio caching. Playwright tests cover the handoff on desktop and mobile, including failed saves, task edits, and recording feedback. Browser tests mock the database and speech responses; they spend no ElevenLabs credits. Separate opt-in deployment checks exercise the real database and audio integration. Local browser tests use installed Chrome; CI installs Chromium.

## Current limits

This is a fictional demo with browser-scoped workspaces. It has no accounts, role permissions, or cross-device team sharing; workspace IDs are not authentication. Use sample data only. Translation is manual, and text-to-speech reads the supplied language rather than translating it. Dictation and agent-assisted drafting are future work.
