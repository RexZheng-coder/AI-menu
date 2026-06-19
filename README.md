# AI Menu Assistant

A TypeScript MVP for turning menu photo uploads into a structured bilingual ordering experience.

## Problem

Restaurant menus can be hard to read when they are photographed, handwritten, poorly translated, or written in an unfamiliar language. This project explores a practical menu assistant flow: upload menu photos, parse menu content into a typed data model, translate it into Chinese, browse dishes by category, and build an order summary that can be shown to a waiter.

The current app defaults to the real MiMo-backed parsing path when the serverless API is configured, while keeping an explicit mock demo mode for portfolio walkthroughs and offline UI testing.

## Live Demo

Preview deployment: [AI Menu Assistant](https://ai-menu-o57lg26c2-rex-z-projects.vercel.app)

The app is deployment-ready as a static-first MVP with a Vercel serverless parser. The root route `/` and `/?parse=real` use real MiMo parsing; `/?parse=mock` forces the sample menu flow without API cost.

Route modes:

- `/`: Real AI Mode by default.
- `/?parse=real`: Explicit Real AI Mode.
- `/?parse=mock`: Mock Demo Mode with no AI API call.

## MVP Features

- Upload-first flow for menu images
- Mock menu parsing for static deployments
- Bilingual menu display with English and Chinese names/descriptions
- Category-based menu rendering
- Five-level chili indicators and AI-generated allergen labels
- Dish cards with prices, Chinese tags, and AI-estimated spicy level
- AI parsing quality panel with category/item counts, provider/detail metadata, and retry/truncation hints
- Original image comparison for the current upload session
- Local human correction flow to edit, add, or delete parsed dishes before ordering
- Cart with quantity controls
- Per-item notes such as `less spicy`, `no onion`, or `少辣`
- Bilingual/English/Chinese order summary modes with copy support
- Local recent menu history using `localStorage`
- Friendly parse errors, retry actions, timeout handling, and empty-menu validation
- Browser-side image optimization for large menu photos before Vercel upload
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
2. Upload as many menu pages as needed. The browser optimizes them, sends batches of up to three, and limits parsing to two concurrent batches.
3. Click `Scan Menu`.
4. In real mode, the serverless API parses each image batch with MiMo, then the browser merges the sanitized results into one `Menu`.
5. Browse categories and bilingual dish cards.
6. Compare the parsed menu with the original image and correct missing or inaccurate items locally.
7. Add dishes to the cart.
8. Adjust quantities and add notes.
9. Generate and copy an order summary.
10. Reopen previously parsed menus from `Recent Menus`.

## Demo Flow

1. Open the app and start on the upload-first screen.
2. Choose one or more JPG, PNG, or WebP menu images. There is no app-level page-count limit.
3. Click `Scan Menu`.
4. In real mode, the uploaded image is parsed by the configured MiMo serverless route. Use `/?parse=mock` for a cost-free demo.
5. Browse bilingual categories, dish names, descriptions, tags, spice levels, and prices.
6. Add items to the cart, adjust quantities, and add item notes.
7. Generate the bilingual order summary.
8. Reload or revisit the page and load a saved menu from `Recent Menus`.

To force mock/demo parsing, open the app with:

```text
?parse=mock
```

Without MiMo environment variables, the default real mode shows a friendly configuration failure and offers Mock Demo Mode. With MiMo configured on Vercel, real mode posts uploaded images to `POST /api/menus/parse` and validates the model response into the existing menu contract.

## AI/OCR Status

Real AI parsing is available only through the serverless API route and is the default for `/` and `/?parse=real`.

- The frontend uses a single parser seam: `parseMenuImages(files): Promise<Menu>`.
- Mock mode is activated with `?parse=mock` or the `Use Sample Menu` button.
- `POST /api/menus/parse` accepts uploaded image files and calls Xiaomi MiMo from server-side code only.
- Real mode defaults to accuracy-first MiMo direct vision: `MENU_AI_PROVIDER=mimo`, `MENU_PARSE_STRATEGY=vision`, and `MENU_PARSE_DETAIL=accurate`.
- `MENU_PARSE_DETAIL=fast | balanced | accurate` controls the speed/completeness tradeoff. Accurate is slower but preserves more visible menu items.
- Dense menus can fall back to a compact core-fields parse that prioritizes category, English name, Chinese name, and raw price.
- OCR-first remains available only when explicitly selected with `MENU_PARSE_STRATEGY=ocr_first`.
- DeepSeek is not used for vision parsing because the current DeepSeek API/model rejected `image_url` input in diagnostics.
- Server-side MiMo parser modules, enriched single-pass prompts, and sanitization utilities exist under `src/server/*`, `api/*`, and `src/lib/*`.
- API keys are never exposed in frontend code.
- Opening `/` or `?parse=real` before `MIMO_API_KEY` is configured shows a friendly error instead of silently returning mock data.
- Real parsing may send uploaded images to MiMo; use appropriate test images and be mindful of provider cost and image privacy.

## Architecture

Key modules:

- `src/types/menu.ts`: Core TypeScript data contract for menus, categories, items, carts, and order summaries.
- `src/mock/menuMock.ts`: Realistic bilingual mock menu used by static/mock parsing.
- `src/lib/menuUtils.ts`: Cart item creation, cart totals, item lookup, and order summary generation.
- `src/lib/parseMenuImages.ts`: Frontend-facing parser seam. Defaults to the backend parser and falls back to explicit mock mode with `?parse=mock`.
- `src/lib/menuSinglePassPrompt.ts`: Single-pass MiMo vision prompt for bilingual extraction, meaning-based Chinese translations, tags, allergens, spicy level, and prices.
- `src/lib/menuValidation.ts`: Sanitizes unknown AI-shaped JSON into the existing `Menu` type and rejects empty parsed menus.
- `src/lib/menuHistory.ts`: Strongly typed localStorage helpers for saved menu history.
- `src/components/*`: DOM-rendered UI components for upload, history, menu categories, item cards, tags, cart, and order summary.
- `api/menus/parse.ts`: Vercel serverless route for multipart image uploads and MiMo-backed parsing.
- `src/server/imagePreprocessor.ts`: Server-side image preprocessing hook. It logs byte counts and SHA-256 hashes, and optionally uses `sharp` if available; otherwise it safely falls back to no-op processing.
- `src/server/mimoOcrExtractor.ts`: MiMo image-to-text OCR extraction phase for real parsing.
- `src/server/menuTextStructurer.ts`: Text-only MiMo structuring phase that returns lightweight menu JSON.
- `src/server/mimoOcrMenuParser.ts`: OCR-first orchestrator that connects OCR, text structuring, conversion, and sanitization.
- `src/server/mimoChatClient.ts`: Shared MiMo chat-completions client, timeout handling, safe logs, and structured provider errors.
- `src/server/lightweightMenuExtraction.ts`: Shared conversion from lightweight extraction JSON into the existing `Menu` contract.
- `src/server/mimoMenuParser.ts`: Default direct MiMo vision parser for real mode.
- `src/server/*`: Server-only AI/OCR parsing modules, including image conversion, parser handler, and MiMo provider adapters.
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
See `docs/benchmarking.md` for parser quality regression checks and `docs/technical-decisions.md` for the main architecture decisions.

Deployment checklist summary:

- Install dependencies: `npm install`
- Type-check: `npm run typecheck`
- Build: `npm run build`
- Preview production output: `npm run start`
- Deploy `dist/` through Vercel or Netlify using the included config files.
- Smoke test upload, real parsing, `?parse=mock`, menu display, local editing, cart, order summary, history, and friendly error handling after deployment.

For real MiMo parsing on Vercel, configure server-side environment variables:

```bash
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

Use the Xiaomi MiMo pay-as-you-go API key format, usually `sk-xxxxx`, with the OpenAI-compatible base URL above. Do not mix Token Plan `tp-xxxxx` credentials or token-plan base URLs with this route. Real image parsing also requires the selected MiMo model to support image understanding; the default is `mimo-v2.5`.

Set `MENU_PARSE_STRATEGY=ocr_first` only when you explicitly want the older OCR-first pipeline. Direct MiMo vision is the default real parser. Use `MENU_PARSE_DETAIL=fast` for quick demos, `balanced` for a middle ground, or `accurate` for the default completeness-first parser.

Useful diagnostics:

```bash
npm run test:mimo:menu -- "sample menu/menu.jpg"
npm run test:mimo:menu:accurate -- "sample menu/menu.jpg"
npm run test:mimo:menu:fast -- "sample menu/menu.jpg"
npm run benchmark:mimo:menus
```

`benchmark:mimo:menus` reports item, price, Chinese-name, retry, and truncation metrics for local sample menus so prompt changes can be compared before shipping.

## Screenshots

No committed screenshots are included yet. Suggested portfolio captures:

- Upload screen in Real AI Mode
- Parsed bilingual menu with quality panel and original-image comparison
- Cart with notes and copied order summary

The current generated screenshot file is ignored by Git and is not referenced directly in this README.

## Privacy / API Usage

- Real AI Mode sends uploaded images to the configured server-side AI provider for parsing.
- Uploaded images are not stored by this app.
- Mock Demo Mode does not call the AI API.
- API keys stay server-side in Vercel environment variables and are never exposed in browser code.
- Real parsing may incur provider cost, so use non-sensitive test images unless your deployment and provider account are approved for the content.

## Current Limitations

- Real MiMo parsing only works where the Vercel API route is deployed and `MIMO_API_KEY` is set.
- Static-only hosting without the Vercel API route should use `?parse=mock` for the demo flow.
- Pay-as-you-go and Token Plan credentials/base URLs are different; this project is configured for pay-as-you-go.
- Menu history is local to the browser and stored in `localStorage`.
- There is no authentication, database, payment, or order submission.
- Uploaded images are not persisted by this app, but real mode sends them to the configured MiMo provider for parsing.
- AI parsing may be incomplete or wrong; the app sanitizes output but does not guarantee menu accuracy.
- Local item editing is browser-only and intended as a correction UX prototype, not a persisted moderation workflow.
- OCR-first may miss tiny, blurred, cropped, or low-contrast text.
- Real-mode vision parsing defaults to item coverage first. Dense menus may leave descriptions, tags, or allergens empty so more visible item names and prices are preserved.
- If dense fallback is used, the frontend quality panel shows that core item information was parsed only.
- Chinese translations, tags, allergen labels, and five-level spicy estimates are AI-generated. Allergy-sensitive users must confirm ingredients and cross-contamination risks with the restaurant.
- Very dense or complex menus may still need retries, clearer photos, `MENU_PARSE_DETAIL=fast` for demos, or temporary OCR-first comparison.
- Image preprocessing is a safe no-op unless an optional `sharp` runtime is available.
- The app is an MVP rather than a production ordering system.

## Future Roadmap

- Add stronger server-side schema validation and observability.
- Persist corrected menus and edits behind a real backend.
- Add provider-level retries, rate-limit handling, and model response tracing.
- Support persistent menu history with a database.
- Add user accounts only if saved history needs to travel across devices.
- Improve parse-quality review and user correction workflows.
- Add export/share options for order summaries.

## Resume / Portfolio Bullet Suggestions

These are suggested resume bullets, not claims that production AI is already live:

- Built a TypeScript web MVP that turns uploaded menu images into a structured bilingual ordering flow with a MiMo-backed serverless parser, typed menu contracts, local correction UX, cart state, order summaries, and localStorage history.
- Designed an AI-ready parsing architecture with secure server-side provider calls, strict JSON sanitization, accuracy/detail modes, benchmark diagnostics, retryable parse states, and a deployment-safe mock mode.
- Implemented a responsive menu ordering experience with upload guidance, parsing quality metadata, original-image comparison, editable dish cards, quantity controls, item notes, and copyable waiter-ready summaries.

## Security Notes

- Do not put API keys in frontend code.
- `.env` and `.env.local` are ignored.
- `.env.example` documents server-side placeholders only.
- Real AI/OCR should run behind a backend route, not directly in the browser.
