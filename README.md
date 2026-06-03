# AI Menu Assistant

A TypeScript MVP for turning menu photo uploads into a structured bilingual ordering experience.

## Problem

Restaurant menus can be hard to read when they are photographed, handwritten, poorly translated, or written in an unfamiliar language. This project explores a practical menu assistant flow: upload menu photos, parse menu content into a typed data model, translate it into Chinese, browse dishes by category, and build an order summary that can be shown to a waiter.

The current app demonstrates the full frontend experience using mock parsing by default, with an optional Vercel serverless MiMo parser available through the same frontend seam.

## Live Demo

TBD

The app is deployment-ready as a static-first MVP. By default, uploaded menu images intentionally return the mock parsed menu so the full frontend flow can be demonstrated without API cost. Real parsing is opt-in with `?parse=real` after the Vercel MiMo environment variables are configured.

## MVP Features

- Upload-first flow for menu images
- Mock menu parsing for static deployments
- Bilingual menu display with English and Chinese names/descriptions
- Category-based menu rendering
- Dish cards with price, Chinese tags, spicy level, and subtle confidence display
- Cart with quantity controls
- Per-item notes such as `less spicy`, `no onion`, or `少辣`
- Bilingual order summary suitable to show a waiter
- Local recent menu history using `localStorage`
- Friendly parse errors, retry actions, timeout handling, and empty-menu validation
- Static deployment support for Vercel and Netlify

## Tech Stack

- TypeScript
- Static HTML/CSS
- Browser DOM APIs
- `localStorage` for local saved menu history
- No frontend framework
- Vercel serverless API route for optional real MiMo parsing
- No external runtime dependencies

## Current User Flow

1. Open the app.
2. Upload one or more menu images.
3. Click `Scan Menu`.
4. In the current static MVP, the parser returns a realistic mock menu.
5. Browse categories and bilingual dish cards.
6. Add dishes to the cart.
7. Adjust quantities and add notes.
8. Generate a bilingual order summary.
9. Reopen previously parsed menus from `Recent Menus`.

## Demo Flow

1. Open the app and start on the upload-first screen.
2. Choose a JPG, PNG, or WebP menu image.
3. Click `Scan Menu`.
4. In static mock mode, the uploaded image returns the prepared sample parsed menu.
5. Browse bilingual categories, dish names, descriptions, tags, spice levels, and prices.
6. Add items to the cart, adjust quantities, and add item notes.
7. Generate the bilingual order summary.
8. Reload or revisit the page and load a saved menu from `Recent Menus`.

To test the real MiMo parser path, open the app with:

```text
?parse=real
```

Without MiMo environment variables, real mode shows a friendly configuration failure. With MiMo configured on Vercel, real mode posts uploaded images to `POST /api/menus/parse` and validates the model response into the existing menu contract.

## AI/OCR Status

Real AI/OCR parsing is available only through the serverless API route and is not used by default.

- The frontend uses a single parser seam: `parseMenuImages(files): Promise<Menu>`.
- Static deployment defaults to mock parsing.
- Real mode is activated with `?parse=real` or `?ai=1`.
- `POST /api/menus/parse` accepts uploaded image files and calls Xiaomi MiMo from server-side code only.
- Server-side MiMo parser modules, a strict prompt/schema, and sanitization utilities exist under `src/server/*`, `api/*`, and `src/lib/*`.
- API keys are never exposed in frontend code.
- Opening the app with `?parse=real` before `MIMO_API_KEY` is configured shows a friendly error instead of silently returning mock data.
- Real parsing may send uploaded images to MiMo; use appropriate test images and be mindful of provider cost and image privacy.

## Architecture

Key modules:

- `src/types/menu.ts`: Core TypeScript data contract for menus, categories, items, carts, and order summaries.
- `src/mock/menuMock.ts`: Realistic bilingual mock menu used by static/mock parsing.
- `src/lib/menuUtils.ts`: Cart item creation, cart totals, item lookup, and order summary generation.
- `src/lib/parseMenuImages.ts`: Frontend-facing parser seam. Defaults to mock parsing and can call `/api/menus/parse` in real mode.
- `src/lib/menuValidation.ts`: Sanitizes unknown AI-shaped JSON into the existing `Menu` type and rejects empty parsed menus.
- `src/lib/menuHistory.ts`: Strongly typed localStorage helpers for saved menu history.
- `src/components/*`: DOM-rendered UI components for upload, history, menu categories, item cards, tags, cart, and order summary.
- `api/menus/parse.ts`: Vercel serverless route for multipart image uploads and MiMo-backed parsing.
- `src/server/*`: Server-only AI/OCR parsing modules, including image conversion, parser handler, and MiMo provider adapter.
- `scripts/build-static.mjs`: Builds TypeScript and produces a self-contained `dist/` static output.

## Local Development

Type-check:

```bash
npm run typecheck
```

Build the static app:

```bash
npm run build
```

Preview the production output:

```bash
npm run start
```

Then open:

```text
http://127.0.0.1:4173/
```

Local `npm run start` serves the static `dist/` output only. Use a Vercel deployment or `vercel dev` to exercise the serverless `/api/menus/parse` route.

## Build And Deployment

The production-ready static output is generated in `dist/`.

```bash
npm run build
```

Deployment config is included for:

- Vercel: `vercel.json`
- Netlify: `netlify.toml`

See `docs/deployment.md` for exact deployment notes.

Deployment checklist summary:

- Install dependencies: `npm install`
- Type-check: `npm run typecheck`
- Build: `npm run build`
- Preview production output: `npm run start`
- Deploy `dist/` through Vercel or Netlify using the included config files.
- Smoke test upload, mock parsing, menu display, cart, order summary, history, and `?parse=real` error handling after deployment.

For real MiMo parsing on Vercel, configure server-side environment variables:

```bash
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

Use the Xiaomi MiMo pay-as-you-go API key format, usually `sk-xxxxx`, with the OpenAI-compatible base URL above. Do not mix Token Plan `tp-xxxxx` credentials or token-plan base URLs with this route. Real image parsing also requires the selected MiMo model to support image understanding; the default is `mimo-v2.5`.

## Screenshots

Screenshot placeholder:

- Add committed screenshots here when final portfolio images are selected.

The current generated screenshot file is ignored by Git and is not referenced directly in this README.

## Current Limitations

- Mock parsing remains the default, even when MiMo env vars are configured.
- Real MiMo parsing only works where the Vercel API route is deployed and `MIMO_API_KEY` is set.
- Pay-as-you-go and Token Plan credentials/base URLs are different; this project is configured for pay-as-you-go.
- Menu history is local to the browser and stored in `localStorage`.
- There is no authentication, database, payment, or order submission.
- Uploaded images are not persisted by this app, but real mode sends them to the configured MiMo provider for parsing.
- AI parsing may be incomplete or wrong; the app sanitizes output but does not guarantee menu accuracy.
- The app is an MVP rather than a production ordering system.

## Future Roadmap

- Add stronger server-side schema validation and observability.
- Add provider-level retries, rate-limit handling, and model response tracing.
- Support persistent menu history with a database.
- Add user accounts only if saved history needs to travel across devices.
- Improve OCR confidence display and user correction workflows.
- Add export/share options for order summaries.

## Resume / Portfolio Bullet Suggestions

These are suggested resume bullets, not claims that production AI is already live:

- Built a TypeScript static web MVP that turns uploaded menu images into a structured bilingual menu browsing flow using a mock parsing layer, typed menu contracts, cart state, order summaries, and localStorage history.
- Designed an AI-ready menu parsing architecture with a secure server-side parser seam, strict JSON sanitization, retryable parse states, and deployment-safe mock mode.
- Implemented a responsive menu ordering experience with upload validation, friendly parse errors, saved menu history, quantity controls, item notes, and bilingual waiter-ready summaries.

## Security Notes

- Do not put API keys in frontend code.
- `.env` and `.env.local` are ignored.
- `.env.example` documents server-side placeholders only.
- Real AI/OCR should run behind a backend route, not directly in the browser.
