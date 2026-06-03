# Deployment

This is a static-first MVP. The deployed app defaults to mock parsing mode and does not require API keys unless real MiMo parsing is enabled with `?parse=real`.

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
- Environment variables: none required for mock mode
- Environment variables for real MiMo mode: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`

Recommended flow:

1. Import the repository into Vercel.
2. Confirm the build command is `npm run build`.
3. Confirm the output directory is `dist`.
4. For real parsing, add the MiMo environment variables below in Vercel Project Settings.
5. Deploy.
6. Run the post-deployment smoke test checklist.

Server-side MiMo variables:

```text
MIMO_API_KEY=your-server-side-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

Do not prefix these with frontend/public env names. They must stay server-side only.

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
- Opening `?parse=real` without `MIMO_API_KEY` shows a friendly configuration failure.
- Opening `?parse=real` with MiMo env vars configured can parse a real menu image through `/api/menus/parse`.
- Desktop and mobile widths do not show broken layout or horizontal overflow.

Real parsing sends uploaded images to MiMo and may incur provider cost. Use non-sensitive test images unless your deployment and provider account are approved for the image content you upload.

## What Works In The Static MVP

- Upload-first menu flow
- Mock menu parsing
- Parsed bilingual menu rendering
- Cart quantities, notes, totals, and order summary
- Local menu history with `localStorage`
- Friendly errors and retry states
- Optional Vercel serverless MiMo parser via `?parse=real`

## Real MiMo Parser

The Vercel route `POST /api/menus/parse` accepts multipart image uploads from the `images` field. It rejects non-image files, enforces the same 10MB per-file limit as the frontend, converts images to data URLs, calls MiMo server-side, and sanitizes the model output into the app's `Menu` type.

API keys must stay server-side only in `MIMO_API_KEY`. Mock mode remains the default even when MiMo is configured.

## Netlify Limitation

The current real parser route is implemented for Vercel serverless functions. Netlify deployment remains suitable for the mock/static MVP unless an equivalent Netlify function is added later.
