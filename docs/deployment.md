# Deployment

This is currently a frontend-only static MVP. The deployed app defaults to mock parsing mode and does not require API keys.

## Local Build

```bash
npm run typecheck
npm run build
```

The production-ready static output is written to `dist/`.

## Local Preview

```bash
npm run start
```

Open `http://127.0.0.1:4173/`.

## Deploy To Vercel

Use the included `vercel.json`.

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other/static

No environment variables are required for the current mock/static MVP.

## Deploy To Netlify

Use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`

No environment variables are required for the current mock/static MVP.

## What Works In The Static MVP

- Upload-first menu flow
- Mock menu parsing
- Parsed bilingual menu rendering
- Cart quantities, notes, totals, and order summary
- Local menu history with `localStorage`
- Friendly errors and retry states

## What Requires A Future Backend

Real AI/OCR parsing requires a server route such as `POST /api/menus/parse`.
API keys must stay server-side only, for example in `AI_MENU_OPENAI_API_KEY`.

If the deployed static app is opened with `?parse=real` before that backend exists, it should show a friendly error instead of silently returning mock data.
