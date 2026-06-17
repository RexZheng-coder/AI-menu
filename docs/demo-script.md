# Demo Script

Use this as a 30-60 second walkthrough for a portfolio demo.

## Short Version

Restaurant menus can be hard to read when they are photographed, translated inconsistently, or written in an unfamiliar language. AI Menu Assistant is a static TypeScript MVP that demonstrates the customer-facing flow for turning menu photos into a bilingual ordering experience.

First, I start from the upload screen and choose a menu image. By default, the app uses the Vercel serverless MiMo parser when configured, while `?parse=mock` is available for a cost-free sample menu demo.

The parsed result is displayed like a food ordering app: dishes are grouped by category, each item has original and Chinese names, description space when available, tags, AI-estimated spice level, and price. I can compare the result with the original image and locally edit, add, or delete dishes before ordering.

Then I add a few dishes to the cart, adjust quantities, add notes like "less spicy" or "no onion", and generate a bilingual, English, or Chinese order summary that can be copied and shown to a waiter.

The app also saves recent parsed menus in localStorage, so I can reload the page and reopen a previous menu without a database.

For the real parsing path, the same frontend `parseMenuImages` seam can post to a Vercel serverless `POST /api/menus/parse` route with `?parse=real`. That route calls Xiaomi MiMo server-side, so API keys stay out of browser code.

## Demo Beats

1. Problem: photographed or foreign-language menus are hard to turn into confident orders.
2. Upload: choose a sample menu image and click `Scan Menu`.
3. Quality: point out item/category counts, parse detail, provider metadata, and the original-image comparison.
4. Editing: correct an item, add a missing item, or delete an incorrect item locally.
5. Menu: show bilingual categories, dish cards, prices, tags, and AI-estimated spice level.
6. Cart: add items, adjust quantities, and enter item notes.
7. Summary: generate and copy a waiter-ready order summary.
8. History: reload or use `Recent Menus` to show localStorage persistence.
9. Mock fallback: show `?parse=mock` or `Use Sample Menu` for a no-cost demo.

## Real-Mode Note

Opening `/` or `?parse=real` demonstrates the MiMo-backed route. If `MIMO_API_KEY` is not configured, it should show a friendly configuration failure and offer Mock Demo Mode instead of silently pretending real AI ran.
