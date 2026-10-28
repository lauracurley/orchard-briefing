# Orchard Briefing

Clear instructions for an orchard crew—in English and Spanish.

**[Open the demo](https://orchard-briefing.vercel.app/)**

Managers prepare and review tasks, including work locations, materials, and completion criteria. Workers read the same instructions in their preferred language, start work, mark it done, or report a blocker. The demo uses fictional orchard examples.

## Current preview

- Separate **Management** and **Worker** views of one browser-scoped workspace.
- Prepared bilingual examples; editable English and Spanish instructions.
- Explicit review before publishing. Custom notes are manually structured and translated during this preview; no simulated model output.
- Draft recovery on the same device, database-backed published tasks, progress filters, and crew problem notes.
- Optimistic revision checks reject conflicting edits. Other tabs refresh through BroadcastChannel; switching views, focusing the page, or pressing Refresh fetches current work.
- New voice generation, transcription, and agent sessions are **locked off in server code**. No environment flag alone can enable spending. Per-task playback only looks up saved audio; a cache miss never calls ElevenLabs.

This is a role preview, not a multi-user production system. Browser workspace IDs are unguessable identifiers, **not authentication**. The two views do not enforce separate permissions, and different devices do not share an orchard. Do not enter private records or employee information.

## Architecture

- Next.js App Router, React, TypeScript
- GraphQL route for workspace creation, validated task publication and status changes
- Neon PostgreSQL for tasks, translations, revisions and reusable audio
- Existing ElevenLabs TTS, Scribe and ElevenAgents server integrations retained behind the preview gate

`src/lib/work-order.ts` defines the task contract, validation and fictional examples. `TaskEditor` handles review; `TaskCard` handles worker actions and read-only playback. `OrchardApp` coordinates the workspace. `src/lib/voice-policy.ts` is the release gate for live provider requests.

Audio identity includes workspace, exact spoken text, language, voice, model and format. Editing spoken instructions changes the cache key; status-only changes do not. A revision check prevents playback against a stale on-screen task. Old whole-list recordings remain in the database and available through the legacy cache endpoints; they are not presented as current per-task recordings.

## Local development

Use Node.js 22.22 or later.

```sh
npm ci
cp .env.example .env.local
# Set DATABASE_URL privately in .env.local.
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

Open http://localhost:3000/. A new browser workspace receives three fictional bilingual tasks. Existing workspaces retain their tasks. The migration is additive and repeatable; it does not rewrite existing instructions.

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests cover publication requirements, translation completeness, blocker validation, audio identity and credit locks. Playwright tests exercise desktop and phone layouts, draft recovery, failed saves, task edits, and the English/Spanish handoff with mocked GraphQL responses. Paid endpoints are intercepted and asserted unused. Direct HTTP tests also verify the server capture locks. Local browser tests use installed Chrome; CI installs Chromium.

The database-backed flow must additionally be smoke-tested after deployment; browser mocks do not establish database integration correctness. Run `ORCHARD_SMOKE_URL=https://your-deployment.example node scripts/smoke.mjs` explicitly against the intended deployment. It creates one isolated fictional workspace and checks persistence, revision conflicts, translation validation and workspace isolation without requesting voice generation.

## Deployment and live speech

Run the migration before deploying to Vercel. Store secrets only in environment settings, never in source control. No new provider credentials are required for this preview. See [design and release notes](docs/product-design.md) for scope and acceptance criteria, and [agent configuration](docs/elevenlabs-agent.md) for the retained agent contract.

Enabling speech is a separate release: approve a minimal live test, select the English/Spanish voices, validate pronunciation and translation, then connect a restricted manager publication action to generation. Worker playback must remain read-only. Review quota controls and cache retention before enabling anything.

This is a personal, noncommercial prototype. Real operational use requires authentication, explicit crew access, and review of hosting and speech licensing. No private planning notes, credentials or real orchard records belong in this public repository.
