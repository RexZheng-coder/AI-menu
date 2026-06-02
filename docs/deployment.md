# Deployment

This is currently a frontend-only static MVP. The deployed app defaults to mock parsing mode and does not require API keys.

## Deployment Checklist

```bash
npm install
npm run typecheck
npm run build
npm run start
```

Open `http://127.0.0.1:4173/` and run the smoke test checklist below before deploying.

The production-ready static output is written to `dist/`.

## Deploy To Vercel

Use the included `vercel.json`.

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other/static
- Environment variables: none required for the current mock/static MVP

Recommended flow:

1. Import the repository into Vercel.
2. Confirm the build command is `npm run build`.
3. Confirm the output directory is `dist`.
4. Deploy.
5. Run the post-deployment smoke test checklist.

## Deploy To Netlify

Use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: none required for the current mock/static MVP

Recommended flow:

1. Import the repository into Netlify.
2. Confirm the build command is `npm run build`.
3. Confirm the publish directory is `dist`.
4. Deploy.
5. Run the post-deployment smoke test checklist.

## Post-Deployment Smoke Test

Run this against the deployed URL:

- App loads without console errors.
- Upload screen shows `Mock Demo Mode`.
- Selecting a JPG, PNG, or WebP image creates a preview.
- `Scan Menu` returns the sample parsed menu in static mode.
- Restaurant header, bilingual categories, dish cards, tags, spice levels, confidence, and prices render.
- `+` buttons add dishes to the cart.
- Quantity controls update totals.
- Item notes are retained in the cart.
- Order summary generates bilingual display text.
- Recent menu history appears after parsing and can reload a saved menu.
- Opening `?parse=real` shows a friendly backend-not-ready failure state.
- Desktop and mobile widths do not show broken layout or horizontal overflow.

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
