# Demo Script

Use this as a 30-60 second walkthrough for a portfolio demo.

## Short Version

Restaurant menus can be hard to read when they are photographed, translated inconsistently, or written in an unfamiliar language. AI Menu Assistant is a static TypeScript MVP that demonstrates the customer-facing flow for turning menu photos into a bilingual ordering experience.

First, I start from the upload screen and choose a menu image. In the current static deployment, the app uses a mock parsing layer, so the uploaded image returns a realistic prepared menu instead of calling a live AI backend.

The parsed result is displayed like a food ordering app: dishes are grouped by category, each item has English and Chinese names, Chinese descriptions, tags, spice level, price, and a subtle parse confidence score.

Then I add a few dishes to the cart, adjust quantities, add notes like "less spicy" or "no onion", and generate a bilingual order summary that could be shown to a waiter.

The app also saves recent parsed menus in localStorage, so I can reload the page and reopen a previous menu without a database.

For the next step, the frontend already has a `parseMenuImages` seam and server-side parser modules prepared. Real AI/OCR would be connected through a backend `POST /api/menus/parse` route so API keys stay server-side.

## Demo Beats

1. Problem: photographed or foreign-language menus are hard to turn into confident orders.
2. Upload: choose a sample menu image and click `Scan Menu`.
3. Static mode: explain that the deployed MVP returns mock parsed data by design.
4. Menu: show bilingual categories, dish cards, prices, tags, spice level, and confidence.
5. Cart: add items, adjust quantities, and enter item notes.
6. Summary: generate a bilingual waiter-ready order summary.
7. History: reload or use `Recent Menus` to show localStorage persistence.
8. Roadmap: real AI/OCR connects later through `POST /api/menus/parse`; frontend API keys are never exposed.

## Real-Mode Note

Opening the app with `?parse=real` demonstrates the future backend path. Until a backend route exists, it should show a friendly parse failure instead of silently falling back to mock AI behavior.
