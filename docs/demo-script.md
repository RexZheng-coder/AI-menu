# Demo Script

A 30–60 second walkthrough suitable for portfolio presentations.

## Overview

Restaurant menus can be hard to read when they are photographed, translated inconsistently, or written in an unfamiliar language. AI Menu Assistant turns menu photos into a structured bilingual ordering experience.

## Walkthrough

1. **Problem**: photographed or foreign-language menus are difficult to turn into confident orders.
2. **Upload**: choose a menu image and click "Scan Menu".
3. **Quality**: review item/category counts, parse detail, provider metadata, and compare against the original image.
4. **Editing**: correct an item, add a missing item, or delete an incorrect item locally.
5. **Menu**: browse bilingual categories, dish cards, prices, tags, and AI-estimated spice levels.
6. **Cart**: add items, adjust quantities, and enter item notes.
7. **Summary**: generate a waiter-ready order summary and copy it in bilingual, English, or Chinese mode.
8. **History**: reload the page and reopen a previous menu from "Recent Menus" — the cart is restored automatically.

## Mock vs Real Mode

The same frontend works in both modes:

- **Real mode** (`/` or `?parse=real`): posts images to the Vercel serverless API route, which calls Xiaomi MiMo server-side. API keys stay in Vercel environment variables.
- **Mock mode** (`?parse=mock`): returns the sample menu instantly, no API key or backend required. Click "Use Sample Menu" for the same effect.
