# Technical Decisions

This document records architectural decisions and their rationale so future changes do not undo important product constraints.

## Parser Architecture

### Default Parser

The default real mode uses:

```text
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

The root route `/` and `/?parse=real` use the Vercel API route. `/?parse=mock` forces the sample menu flow for demos, offline review, and environments without API keys.

### Why MiMo Direct Vision

MiMo `mimo-v2.5` supports OpenAI-style `image_url` input with base64 data URLs through the pay-as-you-go API. A single-pass vision prompt reads the image and returns bilingual menu structure in one response, avoiding the latency and layout-context loss of a two-step OCR-first pipeline.

OCR-first (`MENU_PARSE_STRATEGY=ocr_first`) remains available for debugging dense text but adds a second model call and can lose spatial relationships between OCR and structuring steps.

### Why DeepSeek Is Not Used for Vision

DeepSeek `deepseek-v4-flash` rejected the OpenAI-style `image_url` payload during diagnostics. DeepSeek is not routed as a vision provider unless future diagnostics confirm image input support.

### Accuracy-First Detail Mode

`MENU_PARSE_DETAIL=accurate` is the default because users need complete menus more than fast partial parses. Accurate mode asks for all visible items, prioritizes item names and prices over optional metadata, and retries once when output appears suspiciously incomplete or truncated.

`fast` and `balanced` modes exist for latency comparison and demos but are not recommended as defaults for dense menus.

For very dense menus, the parser retries with a compact fallback prompt that asks only for category name, English item name, Chinese item name, and raw price. The frontend quality panel warns that only core item information was parsed.

## Human Correction UX

AI parsing can be incomplete or wrong. The frontend includes:

- A quality panel with item/category count and parse metadata.
- Original image comparison for the current upload session.
- Local edit, add, and delete controls for parsed dishes.
- Cart synchronization when a dish name or price is corrected.

Edits are browser-local and saved through localStorage. A production system would persist corrections through a backend with review provenance.

## Image Optimization

Client-side image compression is required because Vercel applies its request-body limit before server-side code runs. Server-side `sharp` preprocessing is a secondary safety net — it is loaded via dynamic import and safely falls back to no-op when unavailable.

## Persistent Configuration

Thresholds, timeouts, and limits are centralized in `src/lib/menuConfig.ts` instead of scattered across individual modules. This prevents the class of bugs where adjusting one timeout (e.g. the Vercel function timeout) requires remembering to update three other files with related values.

## Security and Privacy

- API keys are server-side Vercel environment variables only.
- The browser posts image files only to `/api/menus/parse`; it never calls MiMo directly.
- Uploaded images are not persisted by the app, but real mode sends them to the configured AI provider for parsing.
- Menu history and cart data are stored in the browser's localStorage and never transmitted.
