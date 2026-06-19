# Technical Decisions

This document records the current MVP choices so future changes do not accidentally undo important product constraints.

## Default Parser

Default real mode uses:

```text
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

The root route `/` and `/?parse=real` use the Vercel API route when configured. `/?parse=mock` forces the sample menu flow for demos, offline review, and environments without API keys.

## Why MiMo Direct Vision

MiMo `mimo-v2.5` supports OpenAI-style `image_url` input with base64 data URLs through the pay-as-you-go API. The current parser uses a single-pass vision prompt because it can read the image and return bilingual menu structure in one response.

OCR-first remains available with `MENU_PARSE_STRATEGY=ocr_first`, but it is optional. It can be useful for debugging dense text, yet it adds a second model call and can lose layout context between OCR and structuring.

## Why DeepSeek Is Not Used For Vision

DeepSeek `deepseek-v4-flash` diagnostics rejected the OpenAI-style `image_url` payload used by this app. DeepSeek should not be routed as a vision provider unless a future diagnostic confirms image input support for the selected API and model.

## Accuracy-First Detail Mode

`MENU_PARSE_DETAIL=accurate` is the default because users need complete menus more than a very fast partial parse. Accurate mode asks for all visible items, prefers item names and prices over optional metadata, and retries once when output appears suspiciously incomplete or truncated.

`fast` and `balanced` modes exist for latency comparison and demos, but they should not be treated as production-quality defaults for dense menus.

For very dense menus, the parser can retry with a compact dense-menu fallback prompt. That fallback asks only for category name, English item name, Chinese item name, and raw price. The backend fills safe defaults for optional fields through the existing conversion and sanitization path, and the frontend quality panel warns that core item information was parsed only.

## Human Correction UX

AI parsing can be incomplete or wrong. The frontend therefore includes:

- A quality panel with item/category count and parse metadata.
- Original image comparison for the current upload session.
- Local edit, add, and delete controls for parsed dishes.
- Cart synchronization when a dish name or price is corrected.

These edits are browser-local and saved only through the current localStorage history flow. A production system would persist corrections through a backend and probably record review provenance.

## Security And Privacy

API keys stay server-side in Vercel environment variables. The browser posts image files only to `/api/menus/parse`; it never calls MiMo directly.

The app does not persist uploaded images, but real mode sends them to the configured AI provider. Use non-sensitive test images unless the deployment and provider account are approved for the content.
