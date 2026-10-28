# Development and deployment

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

The demo window intercepts API requests and keeps fictional tasks only in memory. Speech generation is blocked in this UI-only preview; use a configured deployment to test recordings. Changes there disappear when the preview closes. A regular browser tab at port 3100 uses the configured database instead.

## Quality checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests cover publication requirements, translation completeness, blocker validation, audio identity and credit locks. Playwright tests exercise desktop and phone layouts, draft recovery, failed saves, task edits, and the English/Spanish/German handoff with mocked GraphQL responses. Provider endpoints are intercepted; recording-button tests use a small local audio fixture and verify quota feedback and cache replay. Ordinary task flows assert that generation endpoints are unused. Direct HTTP tests also verify the server capture locks. Local browser tests use installed Chrome; CI installs Chromium.

The database-backed flow must additionally be smoke-tested after deployment; browser mocks do not establish database integration correctness. Run `ORCHARD_SMOKE_URL=https://your-deployment.example node scripts/smoke.mjs` explicitly against the intended deployment. It creates one isolated fictional workspace and checks persistence, revision conflicts, translation validation and workspace isolation without requesting voice generation.

## Deployment and live speech

Run the migration before deploying to Vercel. The German update adds only a nullable `german` JSONB field; existing tasks and drafts remain valid, with missing German translations explicitly indicated. Store secrets only in environment settings, never in source control. No new provider credentials are required for this preview. See [design and release notes](product-design.md) for scope and acceptance criteria, and [agent configuration](elevenlabs-agent.md) for the retained agent contract.

### Recording budget

The public demo allows at most **6 new recording attempts and 1,200 submitted characters per UTC day**, and **4,000 characters per UTC calendar month**, shared across the entire site. One action prepares English, Spanish and German together. Existing recordings are reused; all missing languages must fit the remaining budget before any provider call starts. Each recording is limited to 600 characters. A single PostgreSQL row is updated atomically to prevent concurrent visitors or server instances from overspending. Database constraints enforce the same ceilings. Failed or timed-out provider attempts conservatively retain their reservation; no automatic retry occurs.

Saved audio is checked before reserving budget. Concurrent requests use cache claims to prevent duplicate generation; cache hits and repeated playback use no generation allowance. Exact fictional examples share cached audio across demo workspaces. Custom text never enters that shared cache. If one provider request fails, successful languages remain cached and retrying generates only the missing recordings. All three text translations must exist before generation. Set `ELEVENLABS_TASK_AUDIO_ENABLED=false` to stop new recordings without disabling replay.

The integration uses [ElevenLabs’ documented text-to-speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), Multilingual v2 and MP3 output. Translation is prepared and reviewed before synthesis; text-to-speech does not translate. Scribe and agent-based drafting remain future work.

This is a personal, noncommercial prototype. Real operational use requires authentication, explicit crew access, and review of hosting and speech licensing. No private planning notes, credentials or real orchard records belong in this public repository.
