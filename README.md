# Orchard Briefing

Clear instructions for an orchard crew—in English, Spanish and German.

**[Open the demo](https://orchard-briefing.vercel.app/)**

In **Plan work**, prepare and review tasks, including work locations, materials, and completion criteria. In **Today’s tasks**, read the same instructions in their preferred language, start work, mark it done, or report a blocker. The demo uses fictional orchard examples.

## Current preview

- Separate **Plan work** and **Today’s tasks** views of one browser-scoped workspace.
- Prepared three-language examples; editable English, Spanish and German instructions.
- Explicit review before publishing. Custom notes are manually structured and translated during this preview; no simulated model output.
- Draft recovery on the same device, database-backed published tasks, progress filters, and crew problem notes.
- Optimistic revision checks reject conflicting edits. Other tabs refresh through BroadcastChannel; switching views, focusing the page, or pressing Refresh fetches current work.
- **Create recording** explicitly calls ElevenLabs for the reviewed task in the selected language. Saved recordings replay without another provider call. Automatic playback lookups never generate speech. Transcription, agent sessions and legacy whole-list generation remain disabled.

This is a role preview, not a multi-user production system. Browser workspace IDs are unguessable identifiers, **not authentication**. The two views do not enforce separate permissions, and different devices do not share an orchard. Do not enter private records or employee information.

## Architecture

- Next.js App Router, React, TypeScript
- GraphQL route for workspace creation, validated task publication and status changes
- Neon PostgreSQL for tasks, translations, revisions and reusable audio
- Existing ElevenLabs TTS, Scribe and ElevenAgents server integrations retained behind the preview gate

`src/lib/work-order.ts` defines the task contract, validation and fictional examples. `TaskEditor` handles review; `TaskCard` handles task actions and read-only playback. `OrchardApp` coordinates the workspace. `src/lib/task-audio.ts` owns recording identity, provider requests and atomic budget reservations. `src/lib/voice-policy.ts` keeps legacy generation and capture integrations disabled.

Audio identity includes exact spoken text, language, voice, model and format. Custom tasks also include the workspace; only exact public fixture text shares a recording across visitors. Editing spoken instructions changes the cache key; status-only changes do not. A revision check prevents playback against a stale on-screen task. Old whole-list recordings remain in the database and available through the legacy cache endpoints; they are not presented as current per-task recordings.

## Local development

Use Node.js 22.22 or later.

```sh
npm ci
cp .env.example .env.local
# Set DATABASE_URL privately in .env.local.
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

Open http://localhost:3000/. A new browser workspace receives three fictional tasks in English, Spanish and German. Existing workspaces retain their tasks. The migration is additive and repeatable; it does not rewrite existing instructions.

To review the UI without a database, build and run the local app, then open the separate Chrome demo window:

```sh
npm run build -- --webpack
npm run start -- --hostname 127.0.0.1 --port 3100
# In another terminal:
npm run preview:demo
```

The demo window intercepts API requests and keeps fictional tasks only in memory. Changes there disappear when the preview closes. A regular browser tab at port 3100 uses the configured database instead.

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests cover publication requirements, translation completeness, blocker validation, audio identity and credit locks. Playwright tests exercise desktop and phone layouts, draft recovery, failed saves, task edits, and the English/Spanish/German handoff with mocked GraphQL responses. Provider endpoints are intercepted; recording-button tests use a small local audio fixture and verify quota feedback and cache replay. Ordinary task flows assert that generation endpoints are unused. Direct HTTP tests also verify the server capture locks. Local browser tests use installed Chrome; CI installs Chromium.

The database-backed flow must additionally be smoke-tested after deployment; browser mocks do not establish database integration correctness. Run `ORCHARD_SMOKE_URL=https://your-deployment.example node scripts/smoke.mjs` explicitly against the intended deployment. It creates one isolated fictional workspace and checks persistence, revision conflicts, translation validation and workspace isolation without requesting voice generation.

## Deployment and live speech

Run the migration before deploying to Vercel. The German update adds only a nullable `german` JSONB field; existing tasks and drafts remain valid, with missing German translations explicitly indicated. Store secrets only in environment settings, never in source control. No new provider credentials are required for this preview. See [design and release notes](docs/product-design.md) for scope and acceptance criteria, and [agent configuration](docs/elevenlabs-agent.md) for the retained agent contract.

### Recording budget

The public demo allows at most **6 new recording attempts and 1,200 submitted characters per UTC day**, and **4,000 characters per UTC calendar month**, shared across the entire site. Each recording is limited to 600 characters. A single PostgreSQL row is updated atomically to prevent concurrent visitors or server instances from overspending. Database constraints enforce the same ceilings. Failed or timed-out provider attempts conservatively retain their reservation; no automatic retry occurs.

Saved audio is checked before reserving budget. Identical concurrent requests share a cache claim; cache hits and repeated playback use no generation allowance. Exact fictional examples share cached audio across demo workspaces. Custom text never enters that shared cache. Set `ELEVENLABS_TASK_AUDIO_ENABLED=false` to stop new recordings without disabling replay.

The integration uses [ElevenLabs’ documented text-to-speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), Multilingual v2 and MP3 output. Translation is prepared and reviewed before synthesis; text-to-speech does not translate. Scribe and agent-based drafting remain future work.

This is a personal, noncommercial prototype. Real operational use requires authentication, explicit crew access, and review of hosting and speech licensing. No private planning notes, credentials or real orchard records belong in this public repository.
