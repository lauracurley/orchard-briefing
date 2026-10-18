# Orchard Briefing

A small field list for nut orchard growers. Record tasks for chestnuts, walnuts, heartnuts, and hazels, then hear an open-task briefing generated with ElevenLabs text to speech.

**Live demo:** https://orchard-briefing.vercel.app/

## Stack

- Next.js, React, and TypeScript
- GraphQL endpoint at `/api/graphql`
- Neon PostgreSQL via its serverless driver
- ElevenLabs text to speech, called from a server route so the API key stays private

The demo uses a random ID saved in each browser. It is for sample tasks only: there are no accounts or private orchard records. The spoken briefing is limited to two requests per browser ID and 25 requests across the site in a 24-hour period.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and set a Neon PostgreSQL connection string, ElevenLabs API key, and voice ID.
3. `DATABASE_URL="..." npm run db:migrate`
4. `npm run dev`

Open `http://localhost:3000`. The first visit seeds three fictional tasks for that browser.

## Deploy for free

1. Create a free Neon project and run the migration against its connection string.
2. Import this repo into a Vercel Hobby project.
3. Set `DATABASE_URL`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID` in Vercel project environment variables.
4. Deploy. Vercel runs the Next.js build automatically.

Keep all credentials in environment variables. Never commit `.env.local`.

## Quality checks

`npm run lint && npm run typecheck && npm test && npm run build`
