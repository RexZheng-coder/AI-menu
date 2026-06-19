# AI Menu Assistant

A TypeScript application that turns restaurant menu photos into a structured bilingual ordering experience. Upload menu images, parse their content into a typed data model with AI, browse dishes bilingually (English/Chinese), and build a waiter-ready order summary.

## Live Demo

- **Production**: [ai-menu-rosy.vercel.app](https://ai-menu-rosy.vercel.app)
- **Source**: [github.com/RexZheng-coder/AI-menu](https://github.com/RexZheng-coder/AI-menu)

## Features

- **Upload-first flow** — select one or more JPG, PNG, or WebP menu images; the browser optimizes them before upload
- **AI-powered parsing** — server-side MiMo vision model extracts structured JSON (categories, items, prices, descriptions, spice levels, allergens)
- **Bilingual display** — every dish name, description, and tag is shown in both English and Simplified Chinese
- **AI quality metadata** — item/category count, parse detail, provider name, retry and truncation indicators
- **Original image comparison** — compare the parsed result against the source photo
- **Local correction** — edit, add, or delete parsed dishes before ordering
- **Shopping cart** — add items with quantity controls and per-item notes (e.g. "less spicy", "no onion")
- **Waiter-ready order summary** — generate, preview, and copy bilingual or single-language summaries
- **Cart persistence** — cart contents survive page refreshes via localStorage
- **Local menu history** — reopen previously parsed menus from localStorage
- **Mock demo mode** — use `?parse=mock` or the "Use Sample Menu" button for a cost-free walkthrough
- **Comprehensive error handling** — friendly messages for timeouts, network failures, invalid files, empty extractions, and configuration issues

## Tech Stack

- TypeScript
- Static HTML/CSS
- Browser DOM APIs
- localStorage for history and cart persistence
- Vercel serverless API route (`POST /api/menus/parse`)
- Xiaomi MiMo vision model (server-side only)
- No external runtime dependencies

## Quick Start

```bash
npm install
npm run typecheck
npm run build
npm run start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) for real parsing (requires a configured backend), or [http://127.0.0.1:4173/?parse=mock](http://127.0.0.1:4173/?parse=mock) for the sample menu demo.

## User Flow

1. Open the app and upload menu photos. The browser optimizes large images, sends batches of up to three, and limits parsing to two concurrent batches.
2. Click "Scan Menu". In real mode the serverless API parses each image batch with MiMo; in mock mode the sample menu is returned instantly.
3. Browse the parsed results: categories, bilingual dish cards, prices, AI-estimated spice levels, and allergen labels.
4. Compare against the original image and correct any missing or inaccurate items.
5. Add dishes to the cart, adjust quantities, and add notes.
6. Generate an order summary and copy the bilingual text to show a waiter.
7. Reopen previously parsed menus from "Recent Menus" — carts are restored automatically.

## Architecture

```
index.html (entry point)
└─ src/app/menuPage.ts (main controller, state management)
   ├─ UploadPanel        — image selection, preview, compression
   ├─ HistoryPanel       — saved menu history
   ├─ MenuCategory → MenuItemCard — bilingual menu display
   ├─ CartPanel          — cart items, notes, order summary
   └─ EditDialog         — local item correction modal

api/menus/parse.ts (Vercel serverless route)
└─ src/server/
   ├─ mimoChatClient.ts        — MiMo API client
   ├─ mimoMenuParser.ts        — vision-based parser with retry logic
   ├─ mimoOcrMenuParser.ts     — OCR-first pipeline (optional)
   ├─ mimoOcrExtractor.ts      — image-to-text extraction
   ├─ menuTextStructurer.ts    — text-to-JSON structuring
   ├─ lightweightMenuExtraction.ts — JSON sanitization and conversion
   ├─ menuParseHandler.ts      — server-side parse orchestrator
   ├─ menuImageInput.ts        — image data URL conversion
   └─ imagePreprocessor.ts     — optional sharp-based optimization
```

## Routing

| URL | Mode |
|---|---|
| `/` | Real AI parsing (default) |
| `/?parse=real` | Explicit real AI mode |
| `/?parse=mock` | Mock demo, no AI API call |
| `/?debug=1` | Upload metadata debug |

## Environment Variables (Server-Side)

For real MiMo parsing on Vercel:

```text
MIMO_API_KEY=sk-xxxxx
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

## Project Structure

Key modules:

| Module | Purpose |
|---|---|
| `src/types/menu.ts` | Core TypeScript data contracts |
| `src/mock/menuMock.ts` | Bilingual mock menu for demos |
| `src/lib/menuConfig.ts` | Centralized thresholds and timeouts |
| `src/lib/menuUtils.ts` | Cart calculations and order summaries |
| `src/lib/menuMerge.ts` | Multi-batch menu merging |
| `src/lib/parseMenuImages.ts` | Frontend parser seam |
| `src/lib/menuValidation.ts` | JSON sanitization into Menu type |
| `src/lib/menuSinglePassPrompt.ts` | MiMo vision prompts |
| `src/lib/menuHistory.ts` | localStorage helpers for history and cart |
| `src/lib/clientImageCompression.ts` | Browser-side image optimization |
| `src/lib/allergenUtils.ts` | Allergen normalization and display |
| `src/lib/priceUtils.ts` | Price parsing and currency inference |
| `scripts/build-static.mjs` | TypeScript compilation and static output |

## Deployment

Deployment config is included for **Vercel** and **Netlify**. See [docs/deployment.md](docs/deployment.md) for detailed instructions.

```bash
npm run build
# Deploy dist/ via Vercel or Netlify
```

## Parser Detail Modes

| Mode | Behavior |
|---|---|
| `accurate` (default) | Completeness-first, preserves all visible items; retries once on suspiciously low counts |
| `balanced` | Middle ground between speed and coverage |
| `fast` | Compact output for demos; may skip descriptions on dense menus |

## Privacy

- Real AI mode sends uploaded images to the configured MiMo provider for parsing only — images are not stored by the app.
- API keys stay server-side in Vercel environment variables.
- Mock demo mode does not call any AI API.
- Menu history and cart data are stored in the browser's localStorage only.

## Security Notes

- API keys are never exposed in frontend code.
- `.env` and `.env.local` are gitignored.
- All AI/OCR parsing runs server-side through the Vercel API route.
- Uploaded images are not persisted by the application.
