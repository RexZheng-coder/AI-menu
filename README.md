# AI Menu Assistant

A frontend-only TypeScript MVP for turning menu photo uploads into a structured bilingual ordering experience.

## Problem

Restaurant menus can be hard to read when they are photographed, handwritten, poorly translated, or written in an unfamiliar language. This project explores a practical menu assistant flow: upload menu photos, parse menu content into a typed data model, translate it into Chinese, browse dishes by category, and build an order summary that can be shown to a waiter.

The current app is a static MVP. It demonstrates the full frontend experience using mock parsing while preparing a secure backend seam for future AI/OCR integration.

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

## AI/OCR Status

Real AI/OCR parsing is prepared but not active in the static deployment.

- The frontend uses a single parser seam: `parseMenuImages(files): Promise<Menu>`.
- Static deployment defaults to mock parsing.
- Server-side AI parser modules, a strict prompt/schema, and sanitization utilities exist under `src/server/*` and `src/lib/*`.
- Real AI mode requires a future backend route such as `POST /api/menus/parse`.
- API keys are never exposed in frontend code.
- Opening the static app with `?parse=real` before a backend exists shows a friendly error instead of silently returning mock data.

## Architecture

Key modules:

- `src/types/menu.ts`: Core TypeScript data contract for menus, categories, items, carts, and order summaries.
- `src/mock/menuMock.ts`: Realistic bilingual mock menu used by static/mock parsing.
- `src/lib/menuUtils.ts`: Cart item creation, cart totals, item lookup, and order summary generation.
- `src/lib/parseMenuImages.ts`: Frontend-facing parser seam. Defaults to mock parsing and can call `/api/menus/parse` in real mode.
- `src/lib/menuValidation.ts`: Sanitizes unknown AI-shaped JSON into the existing `Menu` type and rejects empty parsed menus.
- `src/lib/menuHistory.ts`: Strongly typed localStorage helpers for saved menu history.
- `src/components/*`: DOM-rendered UI components for upload, history, menu categories, item cards, tags, cart, and order summary.
- `src/server/*`: Server-only AI/OCR parsing preparation, including image conversion, parser handler, and OpenAI-compatible parser module.
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

## Build And Deployment

The production-ready static output is generated in `dist/`.

```bash
npm run build
```

Deployment config is included for:

- Vercel: `vercel.json`
- Netlify: `netlify.toml`

See `docs/deployment.md` for exact deployment notes.

## Screenshots

Screenshot placeholder:

- Add committed screenshots here when final portfolio images are selected.

The current generated screenshot file is ignored by Git and is not referenced directly in this README.

## Current Limitations

- Real AI/OCR is not active in static deployment.
- `?parse=real` requires a future backend route.
- Menu history is local to the browser and stored in `localStorage`.
- There is no authentication, database, payment, or order submission.
- Uploaded images are not persisted.
- The app is a static MVP rather than a production ordering system.

## Future Roadmap

- Add a real backend route for `POST /api/menus/parse`.
- Connect the server parser to a vision-capable AI/OCR provider.
- Add stronger server-side schema validation and observability.
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
